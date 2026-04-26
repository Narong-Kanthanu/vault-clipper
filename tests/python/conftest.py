"""Add native-host/ to sys.path so tests can import the host module directly."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
NATIVE_HOST_DIR = REPO_ROOT / "native-host"

if str(NATIVE_HOST_DIR) not in sys.path:
    sys.path.insert(0, str(NATIVE_HOST_DIR))
