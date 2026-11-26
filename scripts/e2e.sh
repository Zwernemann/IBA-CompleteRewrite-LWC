#!/usr/bin/env bash
# Runs the end to end tests (e2e/) against an org where both packages are installed and
# the test account was delivered (scripts/org-install-test.sh does both).
#
#   scripts/e2e.sh <org alias>
source "$(dirname "$0")/lib/common.sh"

ORG="${1:?Org-Alias fehlt}"
cd "$REPO_ROOT/e2e"

note "Playwright einrichten"
npm ci --no-audit --no-fund > /dev/null
npx playwright install --with-deps chromium > /dev/null

# Each test signs in with a frontdoor address of its own (e2e/tests/helpers.js): one
# address serves a single sign-in only.
export E2E_ORG="$ORG" SF_SKIP_NEW_VERSION_CHECK=true

note "Tests"
npx playwright test --trace off || fail "Ende-zu-Ende-Tests gescheitert, Bericht unter target/e2e/report."
summary "Ende-zu-Ende-Tests in \`$ORG\` bestanden."
