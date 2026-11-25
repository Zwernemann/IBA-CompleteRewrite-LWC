#!/usr/bin/env bash
# Makes sure the two packages exist in the Dev Hub and that sfdx-project.json knows their
# ids (packageAliases). Creates a package that is missing. Run by package-version.sh before
# every build, so that nobody has to create the packages or copy ids by hand; the ids are
# written into the working copy of the CI only.
#
# Needs a Dev Hub signed in as default (scripts/ci-login.sh devhub).
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

declare -A DIRS=(["SF Frontend IBA"]="force-app" ["SF Frontend IBA Test Data"]="eh-emulation")
declare -A DESCRIPTIONS=(
    ["SF Frontend IBA"]="Report generator for Endress+Hauser in Salesforce (SF IBA)."
    ["SF Frontend IBA Test Data"]="Test data for test orgs. Never installed at E+H."
)

RUNNER_TEMP_DIR="$(mktemp -d)"
EXISTING="$(sf package list --json)"
for name in "SF Frontend IBA" "SF Frontend IBA Test Data"; do
    ID="$(node -e '
        const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
        const p = (r.result || []).find((x) => x.Name === process.argv[1] && x.NamespacePrefix === "mzw");
        console.log(p ? p.Id : "");
    ' "$name" <<< "$EXISTING")"
    if [ -z "$ID" ]; then
        note "Lege das Paket \"$name\" im Dev Hub an"
        # sf package create rewrites sfdx-project.json (and resets versionNumber); keep ours.
        cp sfdx-project.json "$RUNNER_TEMP_DIR/sfdx-project.json"
        ID="$(sf package create --name "$name" --package-type Unlocked --path "${DIRS[$name]}" \
            --description "${DESCRIPTIONS[$name]}" --json \
            | node -e 'const r = JSON.parse(require("fs").readFileSync(0, "utf8")); if (!r.result) { console.error(r.message); process.exit(1); } console.log(r.result.Id);')" \
            || fail "Paket \"$name\" nicht angelegt. Ist der Namespace mzw mit diesem Dev Hub verknuepft?"
        cp "$RUNNER_TEMP_DIR/sfdx-project.json" sfdx-project.json
        summary "Paket \"$name\" im Dev Hub angelegt: \`$ID\`."
    fi
    node -e '
        const fs = require("fs");
        const file = process.argv[1];
        const project = JSON.parse(fs.readFileSync(file, "utf8"));
        project.packageAliases = project.packageAliases || {};
        project.packageAliases[process.argv[2]] = process.argv[3];
        fs.writeFileSync(file, JSON.stringify(project, null, 2) + "\n");
    ' "$REPO_ROOT/sfdx-project.json" "$name" "$ID"
    echo "\"$name\": $ID"
done
