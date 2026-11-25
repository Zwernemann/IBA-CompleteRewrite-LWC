#!/usr/bin/env bash
# Writes the texts of the E+H translation library anew (static resource dibaTranslations)
# and the report templates the tests compare against (test/reporttexts/templates.json),
# with the code and library of IBA-Salesforce. Needed when the library changes.
#
#   scripts/export-translations.sh <checkout of IBA-Salesforce>
source "$(dirname "$0")/lib/common.sh"

SOURCE="$(cd "${1:?Pfad zum Checkout von IBA-Salesforce fehlt}" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

note "Baue iba-core in $SOURCE"
(cd "$SOURCE" && ./mvnw -q -B -ntp -pl iba-core -am -DskipTests install \
    && ./mvnw -q -B -ntp -pl iba-core dependency:build-classpath -Dmdep.outputFile="$WORK/cp.txt") \
    || fail "iba-core nicht gebaut."
JAR="$(ls "$SOURCE"/iba-core/target/iba-core-*.jar | head -1)"

note "Texte und Vorlagen"
java -Dfile.encoding=UTF-8 -cp "$JAR:$(cat "$WORK/cp.txt")" "$REPO_ROOT/tools/translations/ExportTranslations.java" \
    "$REPO_ROOT/force-app/main/default/staticresources/dibaTranslations.json" \
    "$REPO_ROOT/test/reporttexts/templates.json" 2> /dev/null \
    || fail "Export gescheitert."
note "Geschrieben; pruefen mit: npm test"
