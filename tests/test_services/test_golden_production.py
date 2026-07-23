"""Ensure golden matrix assets ship inside app/ (not tests/)."""

from __future__ import annotations

from app.services.golden.loader import FIXTURES, load_matrix, matrix_cells


def test_golden_fixtures_live_under_app():
    assert FIXTURES.is_dir()
    assert (FIXTURES / "matrix.json").is_file()


def test_golden_matrix_cells_load():
    cells = matrix_cells()
    assert len(cells) >= 12
    assert load_matrix()["cells"]
