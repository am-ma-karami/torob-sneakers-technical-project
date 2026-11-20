"""Read-only MCP connection check. Never prints credentials or uses generation credits."""

import argparse
import json
import os
import ssl
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--load-local-env", action="store_true")
parser.add_argument("--search", action="store_true")
args = parser.parse_args()
print("Credential inherited from parent process:", bool(os.environ.get("API_KEY_21ST")))
if args.load_local_env:
    for line in (Path(__file__).resolve().parents[1] / ".env").read_text().splitlines():
        if line.startswith("API_KEY_21ST="):
            os.environ.setdefault("API_KEY_21ST", line.partition("=")[2])
key = os.environ.get("API_KEY_21ST")
if not key:
    raise SystemExit("API_KEY_21ST unavailable. Export it privately before launching Codex.")
session = None


def rpc(method, params=None, ident=1):
    global session
    headers = {
        "x-api-key": key,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if session:
        headers["Mcp-Session-Id"] = session
    body = {"jsonrpc": "2.0", "method": method, "params": params or {}}
    if ident is not None:
        body["id"] = ident
    req = urllib.request.Request("https://21st.dev/api/mcp", data=json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(
        req, timeout=35, context=ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    ) as response:
        session = response.headers.get("Mcp-Session-Id") or session
        raw = response.read().decode()
    if not raw:
        return {}
    if raw.startswith("event:") or raw.startswith("data:"):
        chunks = [line[6:] for line in raw.splitlines() if line.startswith("data: ")]
        return json.loads(chunks[-1]) if chunks else {}
    return json.loads(raw)


result = rpc(
    "initialize",
    {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "rad-design-check", "version": "1.0"},
    },
)
print("Initialize:", "error" if "error" in result else "ok")
rpc("notifications/initialized", ident=None)
result = rpc("tools/list", ident=2)
tools = result.get("result", {}).get("tools", [])
print("Discovered tool count:", len(tools))
for tool in tools:
    if tool["name"] in ["search", "get_component", "get_component_demo"] or (
        "component" in tool["name"] and "search" in tool["name"]
    ):
        print(json.dumps(tool, ensure_ascii=False))
if args.search:
    result = rpc(
        "tools/call",
        {"name": "search", "arguments": {"query": "animated tabs segmented control", "limit": 3}},
        ident=3,
    )
    Path(".local/21st-search.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False)[:10000])
