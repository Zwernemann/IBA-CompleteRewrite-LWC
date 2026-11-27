#!/usr/bin/env bash
# Installs package versions into an org, upgrading what is there, and delivers the test
# account through mzw.SfibaImport. Checks that the delivery is complete with 21 rows.
#
#   scripts/org-install-test.sh <org alias> <04t of SF Frontend IBA> <04t of SF Frontend IBA Test Data>
source "$(dirname "$0")/lib/common.sh"

ORG="${1:?Org-Alias fehlt}"
REPORT_VERSION="${2:?Version von SF Frontend IBA fehlt}"
TESTDATA_VERSION="${3:?Version von SF Frontend IBA Test Data fehlt}"
cd "$REPO_ROOT"

# The CRGenerator is not ours: it is installed and updated by whoever runs the org. Here it
# is only checked that the org has the version we were built against or a newer one; only a
# fresh scratch org (INSTALL_DEPENDENCIES=1, scripts/scratch-test.sh) gets it installed.
INSTALLED="$(sf package installed list --target-org "$ORG" --json 2> /dev/null || echo '{}')"
if [ -f target/dependencies.ids ]; then
    while read -r DEP_ID DEP_NAME DEP_VERSION; do
        [ -n "$DEP_ID" ] || continue
        if [ "${INSTALL_DEPENDENCIES:-0}" = "1" ]; then
            note "Installiere $DEP_NAME $DEP_VERSION in $ORG"
            sf package install --package "$DEP_ID" --target-org "$ORG" --wait 30 \
                --publish-wait 10 --no-prompt --security-type AdminsOnly > /dev/null \
                || fail "Installation von $DEP_NAME $DEP_VERSION in $ORG gescheitert."
            continue
        fi
        HAVE="$(node -e '
            const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
            const p = ((r && r.result) || []).find((x) => x.SubscriberPackageName === process.argv[1]);
            console.log(p ? p.SubscriberPackageVersionNumber : "");
        ' "$DEP_NAME" <<< "$INSTALLED")"
        [ -n "$HAVE" ] || fail "$DEP_NAME ist in $ORG nicht installiert; noetig ist $DEP_VERSION oder neuer: $(install_link "$DEP_ID")"
        node -e '
            const key = (v) => v.split(".").map(Number);
            const [have, need] = [key(process.argv[1]), key(process.argv[2])];
            for (let i = 0; i < 4; i++) if ((have[i] || 0) !== (need[i] || 0)) process.exit((have[i] || 0) > (need[i] || 0) ? 0 : 1);
        ' "$HAVE" "$DEP_VERSION" \
            || fail "$DEP_NAME $HAVE in $ORG ist aelter als $DEP_VERSION, gegen die gebaut wurde: $(install_link "$DEP_ID")"
        note "$DEP_NAME $HAVE in $ORG (gebaut gegen $DEP_VERSION)"
    done < target/dependencies.ids
fi

for version in "$REPORT_VERSION" "$TESTDATA_VERSION"; do
    if node -e '
        const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
        process.exit(((r && r.result) || []).some((x) => x.SubscriberPackageVersionId === process.argv[1]) ? 0 : 1);
    ' "$version" <<< "$INSTALLED"; then
        note "$version ist in $ORG schon installiert"
        continue
    fi
    note "Installiere $version in $ORG"
    sf package install --package "$version" --target-org "$ORG" --wait 30 \
        --publish-wait 10 --no-prompt --security-type AdminsOnly > /dev/null \
        || fail "Installation von $version in $ORG gescheitert."
done

note "Weise die Permission Sets zu"
for set in SFIBA_Report_Consultant SFIBA_Data_Sender; do
    sf org assign permset --name "$set" --target-org "$ORG" > /dev/null 2>&1 \
        || sf org assign permset --name "mzw__$set" --target-org "$ORG" > /dev/null 2>&1 \
        || echo "   $set nicht zugewiesen (schon vorhanden?)."
done

note "Liefere die Testanlage"
# A failing script ends sf with an error status; its JSON says why, so it is read anyway.
OUTPUT="$(sf apex run --file scripts/apex/send-testdata.apex --target-org "$ORG" --json || true)"
node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
    if (!r.result || !r.result.success) {
        console.error(r.result ? [r.result.compileProblem, r.result.exceptionMessage, r.result.exceptionStackTrace].filter(Boolean).join("\n") : r.message);
        process.exit(1);
    }
    const log = r.result.logs || "";
    if (!log.includes("DIBA-TEST-OK")) {
        console.error("Die Pruefung im Apex-Skript hat nicht bestanden:\n" + log.split("\n").filter((l) => l.includes("USER_DEBUG")).join("\n"));
        process.exit(1);
    }
' <<< "$OUTPUT" || fail "Testanlage nicht wie erwartet geliefert."
note "Testanlage vollstaendig geliefert, 21 Zeilen"
summary "Installiert und geprueft in \`$ORG\`: $REPORT_VERSION, $TESTDATA_VERSION."
