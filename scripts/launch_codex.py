"""Launch Codex with the private, project-local MCP credential in its environment."""

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env", override=False)
if not os.environ.get("API_KEY_21ST"):
    raise SystemExit("Set API_KEY_21ST privately in .env before launching Codex.")
if "--check" in sys.argv:
    print("API_KEY_21ST is present in the environment passed to the Codex subprocess: True")
    subprocess.run(["codex", "mcp", "get", "21st", "--json"], cwd=root, check=True, env=os.environ.copy())
else:
    os.chdir(root)
    os.execvpe("codex", ["codex", "-C", str(root), *sys.argv[1:]], os.environ.copy())
