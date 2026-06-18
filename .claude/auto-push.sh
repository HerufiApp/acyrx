#!/usr/bin/env bash
# Stop hook: commit any working-tree changes and push them to origin/main.
# Registered in .claude/settings.local.json under hooks.Stop.
set -uo pipefail
cd /home/brown/codex || exit 0

# Nothing changed -> nothing to do (keeps no-op turns silent).
[ -z "$(git status --porcelain)" ] && exit 0

git add -A
git commit -q -m "auto-sync: $(date '+%Y-%m-%d %H:%M:%S')" || exit 0

if git -c credential.helper='!gh auth git-credential' push -q origin HEAD:main 2>/tmp/auto-push.err; then
  printf '{"systemMessage":"Auto-pushed changes to origin/main"}\n'
else
  printf '{"systemMessage":"Auto-commit succeeded but push to origin/main failed: %s"}\n' "$(tr '\n"' '  ' < /tmp/auto-push.err)"
fi
