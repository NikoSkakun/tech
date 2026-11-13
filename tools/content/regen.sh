#!/usr/bin/env bash
# Regenerates everything derived from docs/volumes/<volume>/chapters/*.md for every volume, then runs doccheck.
# Orchestrator / merge gate. One volume only: regen.sh --volume <id>
set -euo pipefail
cd "$(dirname "$0")/../.."
SCOPE=("--all")
[ "${1:-}" = "--volume" ] && SCOPE=("--volume" "${2:?volume id}")
python3 tools/content/build_index.py "${SCOPE[@]}"
python3 tools/content/build_glossary.py "${SCOPE[@]}"
python3 tools/content/export_content.py "${SCOPE[@]}" --quiet
python3 tools/content/export_runtime.py "${SCOPE[@]}"
python3 tools/content/doccheck.py "${SCOPE[@]}" | tail -24
