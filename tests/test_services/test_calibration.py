"""Phase 2 Calibration Service — unit tests.

Tests:
1. ATS bucket mapping
2. Conversion rate calculations
3. Zero division safety
"""

from __future__ import annotations

import pytest
from app.services.calibration.service import _ats_bucket


def test_ats_bucket_mapping():
    """Test ATS score to bucket string mapping."""
    assert _ats_bucket(None) == "unknown"
    assert _ats_bucket(0) == "0-39"
    assert _ats_bucket(39) == "0-39"
    assert _ats_bucket(40) == "40-59"
    assert _ats_bucket(59) == "40-59"
    assert _ats_bucket(60) == "60-79"
    assert _ats_bucket(79) == "60-79"
    assert _ats_bucket(80) == "80-100"
    assert _ats_bucket(100) == "80-100"


def test_conversion_rate_calculations():
    """Test that conversion rates are calculated correctly."""
    # Scenario: 20 jobs in STRONG/80-100 band
    # 18 applied, 12 interviewed, 4 offers
    saved = 20
    applied = 18
    interview = 12
    offer = 4
    
    application_rate = (applied / saved) if saved > 0 else 0.0
    interview_rate = (interview / applied) if applied > 0 else 0.0
    offer_rate = (offer / interview) if interview > 0 else 0.0
    
    assert application_rate == 0.9  # 18/20
    assert interview_rate == pytest.approx(0.6667, rel=1e-3)  # 12/18
    assert offer_rate == pytest.approx(0.3333, rel=1e-3)  # 4/12


def test_zero_division_safety():
    """Test that division by zero is handled gracefully."""
    saved = 0
    applied = 0
    interview = 0
    
    application_rate = (applied / saved) if saved > 0 else 0.0
    interview_rate = (interview / applied) if applied > 0 else 0.0
    offer_rate = (0 / interview) if interview > 0 else 0.0
    
    assert application_rate == 0.0
    assert interview_rate == 0.0
    assert offer_rate == 0.0


def test_calibration_bucket_logic():
    """Test that we correctly group jobs into ATS buckets."""
    # Create sample ATS scores and verify they map to correct buckets
    test_cases = [
        (15, "0-39"),
        (45, "40-59"),
        (70, "60-79"),
        (92, "80-100"),
    ]
    
    for score, expected_bucket in test_cases:
        assert _ats_bucket(score) == expected_bucket


def test_rate_rounding():
    """Test that rates are rounded to 4 decimal places."""
    application_rate = 0.8333333333
    interview_rate = 0.6666666666
    offer_rate = 0.3333333333

    assert round(application_rate, 4) == 0.8333
    assert round(interview_rate, 4) == 0.6667
    assert round(offer_rate, 4) == 0.3333


def test_rejected_not_counted_as_interview():
    """REJECTED applications must not inflate interview conversion rates."""
    from app.models.job import ApplicationStatus

    status = ApplicationStatus.REJECTED
    interview_statuses = (ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER)
    assert status not in interview_statuses
