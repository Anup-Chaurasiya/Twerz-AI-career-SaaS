import asyncio
import os
import re
import shutil
import tempfile
from pathlib import Path
from app.config import get_settings
from app.exceptions import LaTeXCompilationError
from app.services.latex.templates import DEFAULT_TEMPLATE_ID, cls_path_for, get_template_spec
from logging import getLogger

logger = getLogger(__name__)

# Backward-compatible default (classic template)
RESUME_CLS_PATH = cls_path_for(DEFAULT_TEMPLATE_ID)
PDFLATEX_TIMEOUT = 60  # seconds per pass (increased for long resumes)
PDFLATEX_PASSES = 2  # two passes for hyperref bookmarks/cross-references


def _extract_errors(log_text: str) -> str:
    """Extract meaningful error lines from pdflatex log output."""
    lines = log_text.splitlines()
    error_blocks = []
    i = 0
    while i < len(lines):
        if lines[i].startswith("!"):
            block = lines[i : i + 5]
            error_blocks.append("\n".join(block))
            i += 5
        else:
            i += 1

    if error_blocks:
        return "\n\n".join(error_blocks)

    warnings = [l for l in lines if re.search(r"(Undefined|Missing|Too many|Emergency stop)", l)]
    if warnings:
        return "\n".join(warnings[:10])

    return "\n".join(lines[-20:])


async def _run_pdflatex(
    pdflatex_bin: str, tmp_path: Path, env: dict, pass_num: int
) -> tuple[int, bytes, bytes]:
    """Run a single pdflatex pass. Returns (returncode, stdout, stderr)."""
    try:
        process = await asyncio.create_subprocess_exec(
            pdflatex_bin,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "resume.tex",
            cwd=str(tmp_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
    except FileNotFoundError as e:
        raise LaTeXCompilationError(
            f"pdflatex not found at '{pdflatex_bin}'. "
            "Install BasicTeX (brew install --cask basictex) or MacTeX, "
            "then set LATEX_BIN_PATH in .env (e.g. /Library/TeX/texbin)."
        ) from e

    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=PDFLATEX_TIMEOUT)
    except asyncio.TimeoutError:
        process.kill()
        raise LaTeXCompilationError(f"LaTeX compilation timed out on pass {pass_num} (>{PDFLATEX_TIMEOUT}s)")

    return process.returncode, stdout, stderr


def _resolve_pdflatex(tex_bin_path: str) -> str:
    """Return absolute pdflatex path, preferring LATEX_BIN_PATH then PATH."""
    candidates = [
        Path(tex_bin_path) / "pdflatex" if tex_bin_path else None,
        Path("/Library/TeX/texbin/pdflatex"),
        Path("/usr/local/texlive/2025/bin/universal-darwin/pdflatex"),
        Path("/usr/local/texlive/2024/bin/universal-darwin/pdflatex"),
    ]
    for path in candidates:
        if path and path.is_file() and os.access(path, os.X_OK):
            return str(path)
    which = shutil.which("pdflatex")
    if which:
        return which
    return str(Path(tex_bin_path) / "pdflatex") if tex_bin_path else "pdflatex"


async def compile_latex(latex_code: str, *, template_id: str = DEFAULT_TEMPLATE_ID) -> bytes:
    """Compile LaTeX code to PDF bytes using the template's document class."""
    from app.services.latex.sanitizer import validate_latex_content

    settings = get_settings()
    spec = get_template_spec(template_id)
    cls_source = cls_path_for(template_id)

    is_valid, validation_error = validate_latex_content(latex_code)
    if not is_valid:
        logger.error(f"LaTeX validation failed: {validation_error}")
        raise LaTeXCompilationError(f"Resume content has formatting issues: {validation_error}")

    tex_bin_path = settings.LATEX_BIN_PATH
    pdflatex_bin = _resolve_pdflatex(tex_bin_path)
    if not Path(pdflatex_bin).is_file() and shutil.which(pdflatex_bin) is None:
        raise LaTeXCompilationError(
            f"pdflatex not found at '{pdflatex_bin}'. "
            "Install BasicTeX (brew install --cask basictex) or MacTeX, "
            "then set LATEX_BIN_PATH in .env (e.g. /Library/TeX/texbin)."
        )

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        cls_dest = tmp_path / spec.cls_filename
        shutil.copy2(str(cls_source), str(cls_dest))

        tex_path = tmp_path / "resume.tex"
        tex_path.write_text(latex_code, encoding="utf-8")

        env = os.environ.copy()
        bin_dir = str(Path(pdflatex_bin).parent)
        if bin_dir not in env.get("PATH", ""):
            env["PATH"] = bin_dir + os.pathsep + env.get("PATH", "")

        pdf_path = tmp_path / "resume.pdf"
        log_path = tmp_path / "resume.log"
        full_error_log = None

        for pass_num in range(1, PDFLATEX_PASSES + 1):
            returncode, stdout, stderr = await _run_pdflatex(
                pdflatex_bin, tmp_path, env, pass_num
            )

            if returncode != 0:
                if log_path.exists():
                    full_error_log = log_path.read_text(encoding="utf-8", errors="replace")
                    error_detail = _extract_errors(full_error_log)
                else:
                    stdout_str = stdout.decode("utf-8", errors="replace")
                    full_error_log = stdout_str
                    error_detail = _extract_errors(stdout_str)

                if pdf_path.exists() and pdf_path.stat().st_size > 0:
                    logger.warning(f"pdflatex pass {pass_num} returned {returncode} but PDF exists, continuing")
                else:
                    logger.error(f"LaTeX compilation failed on pass {pass_num}:\n{error_detail}")
                    raise LaTeXCompilationError(
                        f"LaTeX compilation failed:\n{error_detail}", full_log=full_error_log
                    )

        if not pdf_path.exists():
            raise LaTeXCompilationError("PDF file not found after compilation")

        return pdf_path.read_bytes()
