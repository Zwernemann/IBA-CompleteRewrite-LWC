#!/usr/bin/env bash
# Builds a new version of a package in the Dev Hub and prints its installation links.
# The Apex tests run in the build; without 75 % coverage a version cannot be promoted.
#
#   scripts/package-version.sh "SF Frontend IBA" [--promote]
#
# Needs a Dev Hub signed in as default (scripts/ci-login.sh devhub).
# Writes the version id (04t...) to stdout's last line and to $VERSION_FILE if set.
source "$(dirname "$0")/lib/common.sh"

PACKAGE="${1:?Paketname fehlt, etwa \"SF Frontend IBA\"}"
PROMOTE="${2:-}"
cd "$REPO_ROOT"

package_known "$PACKAGE" || "$REPO_ROOT/scripts/packages-ensure.sh" > /dev/null \
    || fail "Pakete im Dev Hub nicht gefunden und nicht angelegt."

# A version number can be released only once. If it is, that version is used and nothing is
# built: a build costs minutes and counts against the daily quota of the Dev Hub.
RELEASED_ID="$(sf package version list --packages "$PACKAGE" --released --json 2> /dev/null | node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const want = process.argv[1] + ".";
    const v = ((r && r.result) || []).find((x) => String(x.Version).startsWith(want));
    console.log(v ? v.SubscriberPackageVersionId : "");
' "$(package_version "$PACKAGE")" || true)"

if [ -n "$RELEASED_ID" ]; then
    VERSION_ID="$RELEASED_ID"
    PROMOTE=""
    STATE="freigegeben, schon vorher gebaut"
    note "\"$PACKAGE\" $(package_version "$PACKAGE") ist schon freigegeben, baue nicht neu"
else

note "Baue eine neue Version von \"$PACKAGE\" ($(package_version "$PACKAGE")), das dauert einige Minuten"
RESULT="$(sf package version create --package "$PACKAGE" --installation-key-bypass \
    --code-coverage --wait 60 --json || true)"
VERSION_ID="$(node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
    if (r.status !== 0 || !r.result || !r.result.SubscriberPackageVersionId) {
        console.error(r.message || JSON.stringify(r, null, 2));
        process.exit(1);
    }
    console.log(r.result.SubscriberPackageVersionId);
' <<< "$RESULT")" || fail "Paketversion von \"$PACKAGE\" nicht gebaut."

STATE="Beta, nur in Sandboxes und Scratch Orgs installierbar"
if [ "$PROMOTE" = "--promote" ]; then
    note "Gebe die Version frei"
    sf package version promote --package "$VERSION_ID" --no-prompt > /dev/null \
        || fail "Freigabe von $VERSION_ID gescheitert (Testabdeckung unter 75 % oder Versionsnummer schon freigegeben?)."
    STATE="freigegeben"
fi
fi

note "\"$PACKAGE\" $VERSION_ID ($STATE)"
echo "Installieren, Produktion oder Developer Edition: $(install_link "$VERSION_ID")"
echo "Installieren, Sandbox:                          $(sandbox_install_link "$VERSION_ID")"
summary "### $PACKAGE $(package_version "$PACKAGE")"
summary ""
summary "Version \`$VERSION_ID\`, $STATE."
summary ""
summary "- [Installieren in Produktion oder Developer Edition]($(install_link "$VERSION_ID"))"
summary "- [Installieren in einer Sandbox]($(sandbox_install_link "$VERSION_ID"))"
summary ""
[ -n "${VERSION_FILE:-}" ] && echo "$VERSION_ID" > "$VERSION_FILE"
echo "$VERSION_ID"
