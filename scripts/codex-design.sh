#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# .env is created locally; do not source untrusted environment files.
set -a
. ./.env
set +a
exec codex -C "$PWD" "$@"
