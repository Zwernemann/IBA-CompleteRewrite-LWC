#!/usr/bin/env bash
# Checks that every commit of a push raises the version of each package it changes
# (versionNumber in sfdx-project.json). Without that a release could not be promoted:
# Salesforce releases every major.minor.patch only once.
#
#   scripts/check-version.sh <commit before the push>
source "$(dirname "$0")/lib/common.sh"
cd "$REPO_ROOT"

BASE="${1:-}"
if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ] \
    || ! git cat-file -e "$BASE^{commit}" 2> /dev/null; then
    echo "Kein Vergleichsstand, Pruefung entfaellt."
    exit 0
fi

version_at() { # <commit> <package>; empty where the commit has no sfdx-project.json
    local project
    project="$(git show "$1:sfdx-project.json" 2> /dev/null)" || return 0
    printf '%s' "$project" | node -e '
        const p = JSON.parse(require("fs").readFileSync(0, "utf8"));
        const d = p.packageDirectories.find((x) => x.package === process.argv[1]);
        console.log(d ? d.versionNumber.split(".").slice(0, 3).join(".") : "");
    ' "$2"
}
greater() { # a > b, both major.minor.patch
    node -e '
        const [a, b] = process.argv.slice(1).map((v) => v.split(".").map(Number));
        for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) process.exit(a[i] > b[i] ? 0 : 1); }
        process.exit(1);
    ' "$1" "$2"
}

FAILED=0
for commit in $(git rev-list --reverse "$BASE..HEAD"); do
    parent="$commit^"
    for pair in "DIBA Report:force-app" "DIBA Test Data:eh-emulation"; do
        name="${pair%%:*}"
        dir="${pair#*:}"
        git diff --quiet "$parent" "$commit" -- "$dir" && continue
        before="$(version_at "$parent" "$name")"
        after="$(version_at "$commit" "$name")"
        [ -z "$before" ] && continue
        if ! greater "$after" "$before"; then
            echo "Commit $(git log -1 --format='%h %s' "$commit"): \"$name\" geaendert, Version bleibt $after."
            FAILED=1
        fi
    done
done
[ $FAILED -eq 0 ] || fail "Version nicht erhoeht. In sfdx-project.json versionNumber anheben (docs/entwicklung.md)."
echo "Versionen erhoeht."
