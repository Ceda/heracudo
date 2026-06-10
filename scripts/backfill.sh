#!/usr/bin/env bash
# Backfill review app domains without touching the app itself:
# pulls the app's config via heroku CLI and runs the local postDeploy
# against it. Idempotent — existing domains/records/links are skipped
# or synced, only missing ones get created.
#
# Usage:
#   scripts/backfill.sh <heroku-app> [<heroku-app> ...]
#   scripts/backfill.sh $(heroku apps -A | grep -oE '^fo-review-pr-[0-9]+')
set -uo pipefail

cd "$(dirname "$0")/.."

for app in "$@"; do
  echo "=== ${app}"
  heroku config -a "${app}" --json | node -e '
    const cfg = JSON.parse(require("fs").readFileSync(0, "utf8"));
    Object.entries(cfg).forEach(([key, value]) => {
      if (/^(HRCD_|HEROKU_)/.test(key)) process.env[key] = value;
    });
    require("./lib").postDeploy();
  ' || echo "!!! ${app}: postdeploy failed completely"
done
