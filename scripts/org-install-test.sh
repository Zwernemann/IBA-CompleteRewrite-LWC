#!/usr/bin/env bash
# Installs package versions into an org, upgrading what is there, and delivers the test
# plant through mzw.DibaImport. Checks that the delivery is complete with 20 rows.
#
#   scripts/org-install-test.sh <org alias> <04t of DIBA Report> <04t of DIBA Test Data>
source "$(dirname "$0")/lib/common.sh"

ORG="${1:?Org-Alias fehlt}"
REPORT_VERSION="${2:?Version von DIBA Report fehlt}"
TESTDATA_VERSION="${3:?Version von DIBA Test Data fehlt}"
cd "$REPO_ROOT"

for version in "$REPORT_VERSION" "$TESTDATA_VERSION"; do
    note "Installiere $version in $ORG"
    sf package install --package "$version" --target-org "$ORG" --wait 30 \
        --publish-wait 10 --no-prompt --security-type AdminsOnly > /dev/null \
        || fail "Installation von $version in $ORG gescheitert."
done

note "Weise die Permission Sets zu"
for set in DIBA_Report_Consultant DIBA_Data_Sender; do
    sf org assign permset --name "$set" --target-org "$ORG" > /dev/null 2>&1 \
        || sf org assign permset --name "mzw__$set" --target-org "$ORG" > /dev/null 2>&1 \
        || echo "   $set nicht zugewiesen (schon vorhanden?)."
done

note "Liefere die Testanlage"
OUTPUT="$(sf apex run --file scripts/apex/send-testdata.apex --target-org "$ORG" --json)"
node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
    if (!r.result || !r.result.success) {
        console.error(r.result ? (r.result.exceptionMessage || r.result.compileProblem) : r.message);
        process.exit(1);
    }
    const log = r.result.logs || "";
    if (!log.includes("DIBA-TEST-OK")) {
        console.error("Die Pruefung im Apex-Skript hat nicht bestanden:\n" + log.split("\n").filter((l) => l.includes("USER_DEBUG")).join("\n"));
        process.exit(1);
    }
' <<< "$OUTPUT" || fail "Testanlage nicht wie erwartet geliefert."
note "Testanlage vollstaendig geliefert, 20 Zeilen"
summary "Installiert und geprueft in \`$ORG\`: $REPORT_VERSION, $TESTDATA_VERSION."
