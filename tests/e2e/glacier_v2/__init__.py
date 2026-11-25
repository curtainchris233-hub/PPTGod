"""PPTGod · Glacier UI 2.0 standalone 4-tier Playwright E2E test suite.

This package is strictly isolated from legacy ``tests/e2e/*.py`` modules so it
cannot inherit port-3000 defaults, warm-paper aesthetic checks, or v1 routing
assumptions.
"""

from __future__ import annotations

__version__ = "glacier-v2.0.0"
SUITE_NAME = "PPTGod Glacier UI 2.0 E2E Suite"
DEFAULT_BASE_URL = "http://127.0.0.1:3010"

__all__ = ["__version__", "SUITE_NAME", "DEFAULT_BASE_URL"]
