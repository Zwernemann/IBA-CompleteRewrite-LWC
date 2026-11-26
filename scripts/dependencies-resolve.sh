#!/usr/bin/env bash
# Points the dependency on the CRGenerator at its newest released version with the same
# major version, so that a new CRGenerator version needs no change here. Writes into the
# working copy of the CI only; the repository keeps the version it was last checked with.
# Also writes the 04t of that version to target/dependencies.ids, which org-install-test.sh
# installs before our packages.
#
# Needs a Dev Hub signed in as default (scripts/ci-login.sh devhub). Run once per build.
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

DEPENDENCY="CRGenerator"
CURRENT="$(node -e '
    const p = require(process.argv[1] + "/sfdx-project.json");
    const d = p.packageDirectories.flatMap((x) => x.dependencies || []).find((x) => x.package === process.argv[2]);
    console.log(d ? d.versionNumber : "");
' "$REPO_ROOT" "$DEPENDENCY")"
[ -n "$CURRENT" ] || fail "Keine Abhaengigkeit $DEPENDENCY in sfdx-project.json."
MAJOR="${CURRENT%%.*}"

RESOLVED="$(sf package version list --packages "$DEPENDENCY" --released --json 2> /dev/null | node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const major = Number(process.argv[1]);
    const key = (v) => v.split(".").map(Number);
    const newer = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    let best = null;
    for (const v of (r && r.result) || []) {
        if (key(String(v.Version))[0] !== major) continue;
        if (!best || newer(String(v.Version), String(best.Version))) best = v;
    }
    if (!best) process.exit(1);
    console.log(best.Version + " " + best.SubscriberPackageVersionId);
' "$MAJOR")" || fail "Keine freigegebene Version von $DEPENDENCY mit Hauptversion $MAJOR im Dev Hub."

VERSION="${RESOLVED% *}"
VERSION_ID="${RESOLVED#* }"
NUMBER="$(echo "$VERSION" | cut -d. -f1-3).RELEASED"

node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const project = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const dir of project.packageDirectories) {
        for (const d of dir.dependencies || []) {
            if (d.package === process.argv[2]) d.versionNumber = process.argv[3];
        }
    }
    fs.writeFileSync(file, JSON.stringify(project, null, 2) + "\n");
' "$REPO_ROOT/sfdx-project.json" "$DEPENDENCY" "$NUMBER"

mkdir -p target
echo "$VERSION_ID" > target/dependencies.ids
note "$DEPENDENCY $VERSION ($VERSION_ID)"
summary "Gebaut gegen $DEPENDENCY $VERSION (\`$VERSION_ID\`). Vor SF Frontend IBA installieren: $(install_link "$VERSION_ID")"
summary ""
