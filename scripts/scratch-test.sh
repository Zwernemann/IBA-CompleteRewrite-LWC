#!/usr/bin/env bash
# First installation in an empty org: creates a scratch org from the Dev Hub, installs the
# given versions, delivers the test plant and deletes the org again, also on failure.
#
#   scripts/scratch-test.sh <04t of DIBA Report> <04t of DIBA Test Data>
source "$(dirname "$0")/lib/common.sh"

REPORT_VERSION="${1:?Version von DIBA Report fehlt}"
TESTDATA_VERSION="${2:?Version von DIBA Test Data fehlt}"
cd "$REPO_ROOT"

note "Lege eine Scratch Org an (ohne Namespace, damit das Paket mzw sich installieren laesst)"
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch \
    --no-namespace --duration-days 1 --wait 20 > /dev/null \
    || fail "Scratch Org nicht angelegt (Kontingent des Dev Hub erschoepft?)."
trap 'note "Loesche die Scratch Org"; sf org delete scratch --target-org scratch --no-prompt > /dev/null 2>&1 || true' EXIT

scripts/org-install-test.sh scratch "$REPORT_VERSION" "$TESTDATA_VERSION"
summary "Erstinstallation in einer leeren Scratch Org geprueft."
