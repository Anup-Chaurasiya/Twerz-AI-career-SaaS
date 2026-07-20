"""Unit tests for Phase 4 honesty, notifications, DOCX, roast accuracy, profile warnings."""

from __future__ import annotations

import io
import zipfile
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.job import ApplicationStatus, Job, JobStatus
from app.models.notification import Notification
from app.models.profile import Profile, ProfileStatus
from app.schemas.custom_resume import CustomResumeInfo
from app.schemas.tailor import EvidenceMap, EvidenceSupport, EvidenceItem
from app.services.job.honesty import (
    find_forbidden_in_text,
    forbidden_tools_from_evidence,
    strip_forbidden_mentions,
)
from app.services.job.tailor_pipeline import TailorPipeline
from app.services.latex.docx_builder import build_docx_bytes
from app.services.notifications.service import NotificationService
from app.services.profile.service import _completeness_warning
from app.services.roast.accuracy import assert_ats_checklist_grounded
from app.services.credit.service import CreditService
from app.models.credit import UserCredit, CreditTransaction, TransactionType


def test_forbidden_tools_from_evidence_missing_only():
    em = EvidenceMap(
        items=[
            EvidenceItem(requirement="Python", support=EvidenceSupport.SUPPORTED, evidence_quote="x"),
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING, evidence_quote=None),
            EvidenceItem(requirement="SAML SSO", support=EvidenceSupport.MISSING, evidence_quote=None),
        ]
    )
    forbidden = forbidden_tools_from_evidence(em)
    assert "okta" in forbidden
    assert "saml" in forbidden
    assert "python" not in forbidden


def test_find_forbidden_in_text_detects_okta():
    hits = find_forbidden_in_text("I used Okta for SSO at Acme.", {"okta", "cyberark"})
    assert "okta" in [h.lower() for h in hits]


def test_strip_forbidden_mentions():
    out = strip_forbidden_mentions("Expert in Okta and SAML.", ["Okta", "SAML"])
    assert "okta" not in out.lower()
    assert "[redacted]" in out.lower()


@pytest.mark.asyncio
async def test_cover_letter_honesty_reprompts_then_redacts():
    evidence = {
        "items": [
            {"requirement": "Okta", "support": "MISSING", "evidence_quote": None},
            {"requirement": "Python", "support": "SUPPORTED", "evidence_quote": "used Python"},
        ],
        "gaps": ["Okta"],
        "transferable_themes": [],
    }
    dirty = {"cover_letter": "I bring deep Okta expertise to your team."}
    llm = AsyncMock()
    # generate → repair (substring hits); implied scans return empty via side_effect slots
    llm.run_inference = AsyncMock(
        side_effect=[
            dirty,
            {"violations": []},  # implied scan after generate
            dirty,  # still dirty after repair → redact
            {"violations": []},  # implied scan after repair
        ]
    )

    with patch("app.services.job.tailor_pipeline.LLMInference", return_value=llm):
        pipe = TailorPipeline()
        letter = await pipe.generate_cover_letter(
            profile_info={"name": "A"},
            job_description={"role": "Eng"},
            evidence_map=evidence,
        )
    assert "okta" not in letter.lower()
    assert llm.run_inference.await_count == 4


@pytest.mark.asyncio
async def test_emit_due_follow_ups_idempotent(db_session, test_user):
    profile = Profile(user_id=test_user.id, status=ProfileStatus.READY, resume_info={"name": "A"})
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)

    past = datetime.now(timezone.utc) - timedelta(hours=1)
    job = Job(
        user_id=test_user.id,
        profile_id=profile.id,
        job_description={"company": "Acme", "role": "SWE", "description": "x"},
        status=JobStatus.READY,
        application_status=ApplicationStatus.APPLIED,
        follow_up_at=past,
        follow_up_notified_at=None,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    svc = NotificationService()
    n1 = await svc.emit_due_follow_ups(db_session, user_id=test_user.id)
    n2 = await svc.emit_due_follow_ups(db_session, user_id=test_user.id)
    assert n1 == 1
    assert n2 == 0

    from sqlalchemy import select, func

    count = (
        await db_session.execute(
            select(func.count()).select_from(Notification).where(Notification.user_id == test_user.id)
        )
    ).scalar()
    assert count == 1
    await db_session.refresh(job)
    assert job.follow_up_notified_at is not None


@pytest.mark.asyncio
async def test_stuck_generation_refund_restores_balance(db_session, test_user):
    uc = UserCredit(
        user_id=test_user.id,
        balance=0,
        daily_free_used=0,
        daily_free_reset_date=date.today(),
    )
    db_session.add(uc)
    await db_session.commit()

    profile = Profile(user_id=test_user.id, status=ProfileStatus.READY, resume_info={"name": "A"})
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)

    job = Job(
        user_id=test_user.id,
        profile_id=profile.id,
        job_description={"company": "Acme", "role": "SWE", "description": "x"},
        status=JobStatus.GENERATING_RESUME,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    # Simulate prior consumption of purchased credit
    db_session.add(
        CreditTransaction(
            user_id=test_user.id,
            amount=-1,
            type=TransactionType.CONSUMPTION,
            reference_id=str(job.id),
            description="Resume generation (purchased credit)",
        )
    )
    await db_session.commit()

    svc = CreditService()
    refunded = await svc.refund_stuck_generation_if_needed(db_session, test_user.id, job.id)
    assert refunded is True
    await db_session.refresh(uc)
    assert uc.balance == 1

    # Second call is no-op
    refunded2 = await svc.refund_stuck_generation_if_needed(db_session, test_user.id, job.id)
    assert refunded2 is False
    await db_session.refresh(uc)
    assert uc.balance == 1


def test_docx_has_heading_bullets_and_hyperlinks():
    info = CustomResumeInfo(
        name="Ada Lovelace",
        email="ada@example.com",
        headline="Engineer",
        summary="Builder",
        links=[{"name": "GitHub", "url": "https://github.com/ada"}],
        past_experience=[
            {
                "company_name": "Analytical Engines",
                "role": "Engineer",
                "start_date": "2020",
                "end_date": None,
                "description": ["Shipped algorithms"],
            }
        ],
        educations=[
            {
                "degree": "BSc Math",
                "institution": "Cambridge",
                "start_date": "2016",
                "end_date": "2020",
                "grade": "First",
            }
        ],
        skills={"languages": ["Python"], "frameworks": [], "databases": [], "security": [], "other_technologies": []},
    )
    data = build_docx_bytes(info)
    assert data[:2] == b"PK"
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = set(zf.namelist())
        assert "word/styles.xml" in names
        assert "word/numbering.xml" in names
        assert "word/_rels/document.xml.rels" in names
        doc = zf.read("word/document.xml").decode("utf-8")
        assert "Heading1" in doc or "Summary" in doc
        assert "numPr" in doc or "ListBullet" in doc
        assert "Experience" in doc
        assert "Education" in doc
        assert "First" in doc
        rels = zf.read("word/_rels/document.xml.rels").decode("utf-8")
        assert "hyperlink" in rels
        assert "github.com/ada" in rels


def test_completeness_warning_sparse_experience():
    warn = _completeness_warning(
        {"name": "Ada", "past_experience": []},
        ocr_text_len=500,
    )
    assert warn is not None
    assert "experience" in warn.lower()

    ok = _completeness_warning(
        {"name": "Ada", "past_experience": [{"company_name": "X", "role": "Y", "description": ["z"]}]},
        ocr_text_len=500,
    )
    assert ok is None


def test_roast_ats_checklist_rejects_invented_okta():
    resume_text = "Jane Doe. Python developer at Acme. Built REST APIs."
    checklist = [
        {
            "label": "Skills Section",
            "passed": True,
            "detail": "Lists Okta and Python skills clearly.",
            "category": "content",
        }
    ]
    with pytest.raises(AssertionError, match="Okta|okta"):
        assert_ats_checklist_grounded(checklist, resume_text, forbidden_if_absent=["Okta"])

    checklist_ok = [
        {
            "label": "Skills Section",
            "passed": True,
            "detail": "Lists Python skills clearly.",
            "category": "content",
        }
    ]
    assert_ats_checklist_grounded(checklist_ok, resume_text, forbidden_if_absent=["Okta"])
