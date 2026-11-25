# Shared functions of the scripts. Sourced, not run.
# Output for people is German; code and comments are English.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() {
    echo "FEHLER: $*" >&2
    exit 1
}

note() {
    echo "== $*"
}

# Appends Markdown to the summary of the GitHub job, when there is one.
summary() {
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
        echo "$*" >> "$GITHUB_STEP_SUMMARY"
    fi
}

require_env() {
    local missing=()
    for name in "$@"; do
        [ -n "${!name:-}" ] || missing+=("$name")
    done
    [ ${#missing[@]} -eq 0 ] || fail "Es fehlen die Umgebungsvariablen: ${missing[*]} (siehe docs/einrichtung.md)."
}

# Signs in to an org with the JWT bearer flow and sets an alias.
#   sf_login <alias> <client id> <username> <key in PEM> <login url> [devhub]
sf_login() {
    local alias="$1" client_id="$2" username="$3" key="$4" url="$5" devhub="${6:-}"
    local key_file
    key_file="$(mktemp)"
    printf '%s\n' "$key" > "$key_file"
    local args=(org login jwt --client-id "$client_id" --jwt-key-file "$key_file"
        --username "$username" --instance-url "$url" --alias "$alias")
    [ "$devhub" = "devhub" ] && args+=(--set-default-dev-hub)
    if ! sf "${args[@]}" > /dev/null; then
        rm -f "$key_file"
        fail "Anmeldung an $alias ($username) gescheitert."
    fi
    rm -f "$key_file"
    note "Angemeldet: $alias ($username)"
}

# The version number of a package directory in sfdx-project.json, without build part.
package_version() {
    node -e '
        const p = require(process.argv[1] + "/sfdx-project.json");
        const d = p.packageDirectories.find((x) => x.package === process.argv[2]);
        if (!d) { process.exit(2); }
        console.log(d.versionNumber.split(".").slice(0, 3).join("."));
    ' "$REPO_ROOT" "$1"
}

# Whether sfdx-project.json knows the package id (created once with packages-create.sh).
package_known() {
    node -e '
        const p = require(process.argv[1] + "/sfdx-project.json");
        process.exit((p.packageAliases || {})[process.argv[2]] ? 0 : 1);
    ' "$REPO_ROOT" "$1"
}

install_link() {
    echo "https://login.salesforce.com/packaging/installPackage.apexp?p0=$1"
}

sandbox_install_link() {
    echo "https://test.salesforce.com/packaging/installPackage.apexp?p0=$1"
}
