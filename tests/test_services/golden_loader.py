"""Load golden JD matrix fixtures (personas, JDs, canned evidence)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.schemas.tailor import EvidenceMap, JDAnalysis

FIXTURES = Path(__file__).parent / "fixtures"


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


@lru_cache(maxsize=1)
def load_matrix() -> dict[str, Any]:
    return _read_json(FIXTURES / "matrix.json")


def matrix_cells() -> list[dict[str, Any]]:
    return list(load_matrix()["cells"])


def load_persona(persona: str) -> dict[str, Any]:
    return _read_json(FIXTURES / "personas" / f"{persona}.json")


def load_jd(persona: str, jd_key: str) -> dict[str, Any]:
    return _read_json(FIXTURES / "jds" / persona / f"{jd_key}.json")


def load_evidence_bundle(persona: str, jd_key: str) -> tuple[JDAnalysis, EvidenceMap]:
    """Canned JDAnalysis + EvidenceMap for deterministic unit scoring."""
    data = _read_json(FIXTURES / "expected" / f"{persona}__{jd_key}__evidence.json")
    return JDAnalysis.model_validate(data["jd_analysis"]), EvidenceMap.model_validate(data["evidence_map"])


def load_tailored(persona: str, jd_key: str) -> dict[str, Any] | None:
    path = FIXTURES / "expected" / f"{persona}__{jd_key}__tailored.json"
    if not path.exists():
        return None
    return _read_json(path)


def cell_id(cell: dict[str, Any]) -> str:
    return f"{cell['persona']}__{cell['jd_key']}"
