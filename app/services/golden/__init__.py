"""Golden JD matrix fixtures and invariants (shipped in production for admin QA)."""

from app.services.golden.invariants import (
    assert_ats_moved_or_structure_improved,
    assert_evidence_categories_sum,
    assert_no_forbidden_tools,
    assert_roadmap_policy,
    assert_scores_in_range,
    assert_specificity_non_regression,
)
from app.services.golden.loader import (
    cell_id,
    load_evidence_bundle,
    load_jd,
    load_matrix,
    load_persona,
    load_tailored,
    matrix_cells,
)

__all__ = [
    "assert_ats_moved_or_structure_improved",
    "assert_evidence_categories_sum",
    "assert_no_forbidden_tools",
    "assert_roadmap_policy",
    "assert_scores_in_range",
    "assert_specificity_non_regression",
    "cell_id",
    "load_evidence_bundle",
    "load_jd",
    "load_matrix",
    "load_persona",
    "load_tailored",
    "matrix_cells",
]
