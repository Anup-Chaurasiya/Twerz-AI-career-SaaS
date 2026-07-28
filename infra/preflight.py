#!/usr/bin/env python3
"""Pre-flight check — verify all external services are available.

Usage:
    uv run python infra/preflight.py

Checks:
    1. PostgreSQL connectivity + schema (all expected tables exist)
    2. Gemini Flash model (profile structuring / chat)
    3. Gemini Pro model (resume tailoring)
    4. LaTeX compiler (pdflatex installed and working)
    5. GCS bucket (upload + download + delete roundtrip)
"""

import asyncio
import sys
import time
import uuid
import os

# Colors for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
DIM = "\033[2m"
RESET = "\033[0m"
BOLD = "\033[1m"

EXPECTED_TABLES = {
    "users", "profiles", "jobs", "roasts", "roast_views",
    "tenants", "tenant_domain_rules",
    "credit_packs", "time_pass_tiers", "user_credits", "user_time_passes",
    "credit_transactions", "promo_codes", "promo_redemptions",
    "llm_requests", "sessions", "events",
    "alembic_version",
}

results: list[tuple[str, bool, str, float]] = []


def report(name: str, passed: bool, detail: str, elapsed_ms: float):
    icon = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    time_str = f"{DIM}{elapsed_ms:.0f}ms{RESET}"
    print(f"  {icon}  {name:<40} {time_str}  {detail}")
    results.append((name, passed, detail, elapsed_ms))


async def check_database():
    """Check PostgreSQL connectivity and verify all expected tables exist."""
    from app.config import get_settings
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    t0 = time.monotonic()
    try:
        engine = create_async_engine(get_settings().DATABASE_URL)
        async with engine.connect() as conn:
            # Basic connectivity
            row = await conn.execute(text("SELECT version()"))
            version = row.scalar()
            pg_version = version.split(",")[0] if version else "unknown"

            # Check tables
            rows = await conn.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            ))
            existing = {r[0] for r in rows}
            missing = EXPECTED_TABLES - existing
            extra = existing - EXPECTED_TABLES - {"app_states", "user_states", "adk_internal_metadata"}

        await engine.dispose()
        elapsed = (time.monotonic() - t0) * 1000

        if missing:
            report("PostgreSQL — connectivity", True, pg_version, elapsed)
            report("PostgreSQL — schema", False, f"Missing tables: {', '.join(sorted(missing))}", 0)
        else:
            report("PostgreSQL — connectivity", True, pg_version, elapsed)
            report("PostgreSQL — schema", True, f"{len(existing)} tables OK", 0)
    except Exception as e:
        elapsed = (time.monotonic() - t0) * 1000
        report("PostgreSQL — connectivity", False, str(e)[:80], elapsed)


async def check_llm_flash():
    """Check configured Flash model responds via LiteLLM."""
    from app.config import get_settings
    from app.services.ai.inference import LLMInference

    settings = get_settings()
    t0 = time.monotonic()
    try:
        llm = LLMInference(model_name=settings.LLM_FLASH_MODEL)
        result = await llm.run_inference(
            system_prompt="Reply with exactly: OK",
            inputs=["health check"],
        )
        elapsed = (time.monotonic() - t0) * 1000
        passed = isinstance(result, str) and len(result) > 0
        report(f"LLM Flash ({settings.LLM_FLASH_MODEL})", passed, f"Response: {result[:30]}", elapsed)
    except Exception as e:
        elapsed = (time.monotonic() - t0) * 1000
        report(f"LLM Flash ({settings.LLM_FLASH_MODEL})", False, str(e)[:80], elapsed)


async def check_llm_pro():
    """Check configured Pro model responds via LiteLLM."""
    from app.config import get_settings
    from app.services.ai.inference import LLMInference

    settings = get_settings()
    t0 = time.monotonic()
    try:
        llm = LLMInference(model_name=settings.LLM_PRO_MODEL)
        result = await llm.run_inference(
            system_prompt="Reply with exactly: OK",
            inputs=["health check"],
        )
        elapsed = (time.monotonic() - t0) * 1000
        passed = isinstance(result, str) and len(result) > 0
        report(f"LLM Pro ({settings.LLM_PRO_MODEL})", passed, f"Response: {result[:30]}", elapsed)
    except Exception as e:
        elapsed = (time.monotonic() - t0) * 1000
        report(f"LLM Pro ({settings.LLM_PRO_MODEL})", False, str(e)[:80], elapsed)


async def check_latex():
    """Check pdflatex is installed and can compile a minimal document."""
    from app.services.latex.compiler import compile_latex

    t0 = time.monotonic()
    try:
        pdf = await compile_latex(r"""
\documentclass{resume}
\usepackage[left=0.4in,top=0.3in,right=0.4in,bottom=0.3in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\name{Preflight Check}
\begin{document}
\begin{rSection}{Test}
OK
\end{rSection}
\end{document}
""", template_id="classic")
        elapsed = (time.monotonic() - t0) * 1000
        passed = pdf[:5] == b"%PDF-"
        report("LaTeX compiler (pdflatex)", passed, f"{len(pdf)} bytes", elapsed)
    except Exception as e:
        elapsed = (time.monotonic() - t0) * 1000
        report("LaTeX compiler (pdflatex)", False, str(e)[:80], elapsed)


async def check_gcs():
    """Check GCS bucket access with upload/download/delete roundtrip."""
    from app.services.storage.gcs import GCSClient

    t0 = time.monotonic()
    test_path = f"preflight/{uuid.uuid4().hex}.txt"
    test_data = b"preflight-check"
    try:
        gcs = GCSClient()
        await asyncio.to_thread(gcs.upload_pdf, test_data, test_path)
        downloaded = await asyncio.to_thread(gcs.download_pdf, test_path)
        await asyncio.to_thread(gcs.delete_pdf, test_path)
        elapsed = (time.monotonic() - t0) * 1000
        passed = downloaded == test_data
        report(f"GCS bucket ({gcs.bucket_name})", passed, "upload/download/delete OK", elapsed)
    except Exception as e:
        elapsed = (time.monotonic() - t0) * 1000
        report("GCS bucket", False, str(e)[:80], elapsed)


async def check_golden_matrix():
    """Optional deploy gate — run golden JD matrix (live LLM). Set RUN_GOLDEN_MATRIX=1."""
    t0 = time.monotonic()
    try:
        from app.services.job.tailor_pipeline import TailorPipeline
        from app.services.golden.loader import cell_id, load_jd, load_persona, matrix_cells
        from app.services.golden.invariants import (
            assert_evidence_categories_sum, assert_roadmap_policy, assert_scores_in_range,
        )

        pipeline = TailorPipeline()
        failures = []
        for cell in matrix_cells():
            cid = cell_id(cell)
            try:
                result = await pipeline.analyze_fit_only(
                    profile_info=load_persona(cell["persona"]),
                    job_description=load_jd(cell["persona"], cell["jd_key"]),
                    user_id="preflight-golden",
                    reference_id=cid,
                )
                assert_scores_in_range(result, allow_missing_ats=True)
                assert_evidence_categories_sum(result["evidence_map"])
                assert_roadmap_policy(result["fit_label"], result.get("gap_roadmap"))
                if result["fit_label"] != cell["expected_fit_label"]:
                    failures.append(f"{cid}: label mismatch")
            except Exception as exc:
                failures.append(f"{cid}: {exc}")

        elapsed = (time.monotonic() - t0) * 1000
        if failures:
            report("Golden JD matrix", False, "; ".join(failures[:3]), elapsed)
        else:
            report("Golden JD matrix", True, f"{len(list(matrix_cells()))} cells OK", elapsed)
    except Exception as e:
        elapsed = (time.monotonic() - t0) * 1000
        report("Golden JD matrix", False, str(e)[:80], elapsed)


async def check_jwt_secret():
    """Reject placeholder JWT secrets in non-dev environments."""
    from app.config import get_settings, is_jwt_secret_production_ready

    settings = get_settings()
    t0 = time.monotonic()
    if settings.ENVIRONMENT.upper() == "DEV":
        report("JWT secret", True, "Skipped in DEV", (time.monotonic() - t0) * 1000)
        return
    if is_jwt_secret_production_ready(settings):
        report("JWT secret", True, "Strong secret configured", (time.monotonic() - t0) * 1000)
    else:
        report(
            "JWT secret",
            False,
            "Set JWT_SECRET to a random string with at least 32 characters",
            (time.monotonic() - t0) * 1000,
        )


async def main():
    print(f"\n{BOLD}Twerz — Pre-flight Check{RESET}\n")

    await check_database()
    await check_jwt_secret()
    # Run LLM checks in parallel
    await asyncio.gather(check_llm_flash(), check_llm_pro())
    await check_latex()
    await check_gcs()

    # Optional: run golden JD matrix regression (requires live LLM, blocks deploy on failure)
    if os.environ.get("RUN_GOLDEN_MATRIX") == "1":
        await check_golden_matrix()

    # Summary
    passed = sum(1 for _, p, _, _ in results if p)
    failed = sum(1 for _, p, _, _ in results if not p)
    total_ms = sum(ms for _, _, _, ms in results)

    print(f"\n{BOLD}{'─' * 60}{RESET}")
    if failed == 0:
        print(f"  {GREEN}{BOLD}All {passed} checks passed{RESET} {DIM}({total_ms:.0f}ms total){RESET}\n")
    else:
        print(f"  {RED}{BOLD}{failed} check(s) failed{RESET}, {passed} passed {DIM}({total_ms:.0f}ms total){RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
