#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MODE="${1:---dry-run}"
echo "Mode: $MODE"
echo "Repo logs size before:"
du -sh ./logs 2>/dev/null || true
echo "Targets:"
shopt -s nullglob
FILES=(./logs/*.log ./logs/*.log.* ./logs/*.out ./logs/*.err)
if [[ ${#FILES[@]} -gt 0 ]]; then printf "%s\n" "${FILES[@]}"; else echo "none"; fi
echo "PM2 logs dir:"
du -sh ~/.pm2/logs 2>/dev/null || true
if [[ "$MODE" == "--force" ]]; then
  if [[ ${#FILES[@]} -gt 0 ]]; then rm -f "${FILES[@]}" || true; fi
  if [[ -d "$HOME/.pm2/logs" ]]; then find "$HOME/.pm2/logs" -type f -name "*.log" -size +1M -print -exec truncate -s 0 {} \; 2>/dev/null || true; fi
else
  echo "Dry run; nothing deleted. Use --force to delete and truncate."
fi
echo "Repo logs size after:"
du -sh ./logs 2>/dev/null || true
