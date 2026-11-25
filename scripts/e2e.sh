#!/usr/bin/env bash
# Runs the end to end tests (e2e/) against an org where both packages are installed and
# the test plant was delivered (scripts/org-install-test.sh does both).
#
#   scripts/e2e.sh <org alias>
source "$(dirname "$0")/lib/common.sh"

ORG="${1:?Org-Alias fehlt}"
cd "$REPO_ROOT/e2e"

note "Playwright einrichten"
npm ci --no-audit --no-fund > /dev/null
npx playwright install --with-deps chromium > /dev/null

note "Anmeldeadresse der Org $ORG"
E2E_FRONTDOOR="$(sf org open --url-only --target-org "$ORG" --json | node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
    if (!r.result || !r.result.url) { console.error(r.message); process.exit(1); }
    console.log(r.result.url);
')" || fail "Keine Anmeldeadresse fuer $ORG."
export E2E_FRONTDOOR E2E_ORG="$ORG"

note "Tests"
npx playwright test --trace off || fail "Ende-zu-Ende-Tests gescheitert, Bericht unter target/e2e/report."
summary "Ende-zu-Ende-Tests in \`$ORG\` bestanden."
