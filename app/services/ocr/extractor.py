import asyncio
import base64
import zipfile
from io import BytesIO
from typing import Literal
from xml.etree import ElementTree

import pdfplumber
from pdf2image import convert_from_bytes
from app.services.ai.inference import LLMInference
from app.services.ai.prompts import STRUCTURED_RESUME_SYSTEM_PROMPT
from app.schemas.resume import ResumeInfo
from app.config import get_settings
from logging import getLogger

logger = getLogger(__name__)

ResumeFormat = Literal["pdf", "docx"]
_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def detect_resume_format(filename: str | None, file_bytes: bytes) -> ResumeFormat:
    """Detect uploaded resume format from filename and magic bytes."""
    name = (filename or "").lower()
    if name.endswith(".docx"):
        return "docx"
    if name.endswith(".pdf") or file_bytes[:4].startswith(b"%PDF"):
        return "pdf"
    if file_bytes[:2] == b"PK":
        try:
            with zipfile.ZipFile(BytesIO(file_bytes)) as zf:
                if "word/document.xml" in zf.namelist():
                    return "docx"
        except zipfile.BadZipFile:
            pass
    raise ValueError("Only PDF and DOCX files are supported")


def extract_docx_text(docx_bytes: bytes) -> str:
    """Extract plain text from a .docx file without external dependencies."""
    with zipfile.ZipFile(BytesIO(docx_bytes)) as zf:
        xml_content = zf.read("word/document.xml")
    root = ElementTree.fromstring(xml_content)
    parts: list[str] = []
    for node in root.iter(f"{{{_W_NS}}}t"):
        if node.text:
            parts.append(node.text)
        if node.tail:
            parts.append(node.tail)
    text = " ".join(parts)
    text = " ".join(text.split())
    return text.replace("\x00", "")


class PDFExtractor:
    def __init__(self):
        settings = get_settings()
        self.flash_model = settings.LLM_FLASH_MODEL

    @staticmethod
    def count_pages(pdf_bytes: bytes) -> int:
        """Return the number of pages in a PDF (minimum 1)."""
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            return max(1, len(pdf.pages))

    def extract_text(self, pdf_bytes: bytes) -> str:
        """Fast extraction using pdfplumber without LLM."""
        texts = []
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    texts.append(text)
        # Strip null bytes — some PDFs embed \x00 which PostgreSQL rejects
        return "\n".join(texts).replace("\x00", "")

    def extract_text_and_page_count(self, pdf_bytes: bytes) -> tuple[str, int]:
        """Extract text and page count in a single pdfplumber pass."""
        texts: list[str] = []
        page_count = 1
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            page_count = max(1, len(pdf.pages))
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    texts.append(text)
        return "\n".join(texts).replace("\x00", ""), page_count

    async def extract_and_structure_via_vision(
        self,
        pdf_bytes: bytes,
        *,
        user_id: str | None = None,
        reference_id: str | None = None,
    ) -> dict:
        """Convert PDF to images and send ALL pages + structuring prompt in a single
        LLM call. Returns a ResumeInfo dict directly (no separate structuring step).
        """
        pages = await asyncio.to_thread(convert_from_bytes, pdf_bytes, dpi=200)
        images = []
        for page in pages:
            buf = BytesIO()
            page.save(buf, format="JPEG", quality=85)
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            images.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
            })

        llm = LLMInference(model_name=self.flash_model)
        result = await llm.run_inference(
            system_prompt=STRUCTURED_RESUME_SYSTEM_PROMPT,
            inputs=[
                "Extract and structure ALL information from these resume page images into the given JSON schema.",
                *images,
            ],
            structured_output_schema=ResumeInfo,
            user_id=user_id,
            purpose="profile_structuring_vision",
            reference_id=reference_id,
        )
        return result

    @staticmethod
    def _has_high_non_ascii_ratio(text: str) -> bool:
        if not text:
            return True
        non_ascii = sum(1 for c in text if ord(c) > 127)
        return (non_ascii / len(text)) > 0.3
