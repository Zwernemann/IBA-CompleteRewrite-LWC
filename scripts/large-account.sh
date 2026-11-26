#!/usr/bin/env bash
# Delivers the load test account ("DIBA Lasttest", 50,000 rows by default) into an org with
# the test data package and waits until all its parts have arrived.
#
#   scripts/large-account.sh <org alias> [rows] [transmission id]
#
# With the id of a delivery already started, it only waits for that one.
source "$(dirname "$0")/lib/common.sh"

ORG="${1:?Org-Alias fehlt}"
ROWS="${2:-50000}"
TRANSMISSION="${3:-}"
cd "$REPO_ROOT"
[[ "$ROWS" =~ ^[0-9]+$ ]] || fail "Zeilenzahl muss eine Zahl sein: $ROWS"

if [ -z "$TRANSMISSION" ]; then
    SCRIPT="$(mktemp)"
    sed "s/^Integer rows = [0-9]*;/Integer rows = $ROWS;/" scripts/apex/send-large.apex > "$SCRIPT"
    note "Starte die Lastanlage mit $ROWS Zeilen in $ORG"
    LOG="$(sf apex run --file "$SCRIPT" --target-org "$ORG" 2>&1)" || { echo "$LOG"; fail "Lastanlage nicht gestartet."; }
    # sed reads to the end: a reader that stops early (head) ends the pipe with SIGPIPE,
    # which pipefail turns into a silent exit of the script.
    TRANSMISSION="$(printf '%s\n' "$LOG" | sed -n 's/.*DIBA-LARGE-STARTED \([A-Za-z0-9-]*\).*/\1/p' | sed -n '1p')"
    [ -n "$TRANSMISSION" ] || { echo "$LOG"; fail "Lastanlage nicht gestartet."; }
else
    [[ "$TRANSMISSION" =~ ^[A-Za-z0-9-]+$ ]] || fail "Unbrauchbare Lieferungskennung: $TRANSMISSION"
    note "Warte auf die laufende Lieferung $TRANSMISSION"
fi
PARTS=$(( (ROWS + 999) / 1000 ))
note "Lieferung $TRANSMISSION, $PARTS Teile"

for _ in $(seq 1 90); do
    COUNT="$(sf data query --target-org "$ORG" --json \
        --query "SELECT COUNT() FROM mzw__SFIBA_Transmission__c WHERE mzw__SFIBA_Transmission_Id__c = '$TRANSMISSION'" \
        | node -e 'const r = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log((r.result && r.result.totalSize) || 0);')"
    echo "$COUNT von $PARTS Teilen angekommen"
    if [ "$COUNT" -ge "$PARTS" ]; then
        summary "Lastanlage \"DIBA Lasttest\" mit $ROWS Zeilen in \`$ORG\` geliefert ($PARTS Teile)."
        exit 0
    fi
    sleep 20
done
fail "Nach 30 Minuten erst $COUNT von $PARTS Teilen angekommen."
