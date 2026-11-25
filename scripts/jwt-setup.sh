#!/usr/bin/env bash
# Creates the key pair with which the CI signs in to an org (JWT bearer flow), once per org.
# The private key goes into a GitHub secret, the certificate into the External Client App
# of the org (docs/einrichtung.md). Nothing of it is committed: config/*.key is ignored.
#
#   scripts/jwt-setup.sh devhub
#   scripts/jwt-setup.sh testorg
source "$(dirname "$0")/lib/common.sh"

NAME="${1:?Aufruf: scripts/jwt-setup.sh devhub|testorg}"
KEY="$REPO_ROOT/config/$NAME.key"
CERT="$REPO_ROOT/config/$NAME.crt"
[ -e "$KEY" ] && fail "$KEY gibt es schon. Zum Erneuern erst loeschen."

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1095 \
    -subj "/CN=DIBA CI $NAME" -keyout "$KEY" -out "$CERT" 2> /dev/null \
    || fail "openssl fehlt oder ist gescheitert."
chmod 600 "$KEY"

UPPER="$(echo "$NAME" | tr '[:lower:]' '[:upper:]')"
cat << MSG
Erzeugt (drei Jahre gueltig):
  Zertifikat fuer Salesforce: $CERT
  Privater Schluessel:        $KEY

Weiter in docs/einrichtung.md:
  1. Zertifikat in der External Client App der Org hochladen.
  2. In GitHub unter Settings, Secrets and variables, Actions eintragen:
       SF_${UPPER}_JWT_KEY     den ganzen Inhalt von $KEY
       SF_${UPPER}_CLIENT_ID   den Consumer Key der App
       SF_${UPPER}_USERNAME    den Benutzernamen in der Org
  3. $KEY danach loeschen oder sicher ablegen; er gehoert nicht ins Repository.
MSG
