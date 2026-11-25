#!/usr/bin/env bash
# Creates the two packages in the Dev Hub, once. Afterwards their ids (0Ho...) belong into
# "packageAliases" of sfdx-project.json; the script prints the lines to copy.
# Runs as the workflow "Pakete anlegen"; already existing packages are only listed.
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

declare -A DIRS=(["DIBA Report"]="force-app" ["DIBA Test Data"]="eh-emulation")
declare -A DESCRIPTIONS=(
    ["DIBA Report"]="DIBA Report Generator for Endress+Hauser in Salesforce."
    ["DIBA Test Data"]="Test plant for test orgs. Never installed at E+H."
)

EXISTING="$(sf package list --json)"
for name in "DIBA Report" "DIBA Test Data"; do
    ID="$(node -e '
        const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
        const p = (r.result || []).find((x) => x.Name === process.argv[1] && x.NamespacePrefix === "mzw");
        console.log(p ? p.Id : "");
    ' "$name" <<< "$EXISTING")"
    if [ -z "$ID" ]; then
        note "Lege \"$name\" an"
        ID="$(sf package create --name "$name" --package-type Unlocked --path "${DIRS[$name]}" \
            --description "${DESCRIPTIONS[$name]}" --json \
            | node -e 'const r = JSON.parse(require("fs").readFileSync(0, "utf8")); if (!r.result) { console.error(r.message); process.exit(1); } console.log(r.result.Id);')" \
            || fail "\"$name\" nicht angelegt."
    else
        note "\"$name\" gibt es schon"
    fi
    echo "    \"$name\": \"$ID\","
    summary "- \`\"$name\": \"$ID\"\`"
done
echo "Diese Zeilen in sfdx-project.json unter packageAliases eintragen (ohne das letzte Komma)."
