#!/usr/bin/env bash
# Writes the reference files of the report XML (test/reportxml) anew with the Java code of
# IBA-Salesforce, the version whose XML is the contract with the Crystal templates. Only
# needed when that code changes; the Jest tests compare against the files.
#
#   scripts/reference-xml.sh <checkout of IBA-Salesforce>
#
# Needs JDK 17 and Python 3. Builds iba-core of the checkout with its Maven wrapper.
source "$(dirname "$0")/lib/common.sh"

SOURCE="$(cd "${1:?Pfad zum Checkout von IBA-Salesforce fehlt}" && pwd)"
OUT="$REPO_ROOT/test/reportxml"
TOOLS="$REPO_ROOT/tools/reference-xml"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

note "Baue iba-core in $SOURCE"
(cd "$SOURCE" && ./mvnw -q -B -ntp -pl iba-core -am -DskipTests install \
    && ./mvnw -q -B -ntp -pl iba-core dependency:build-classpath -Dmdep.outputFile="$WORK/cp.txt") \
    || fail "iba-core nicht gebaut."
JAR="$(ls "$SOURCE"/iba-core/target/iba-core-*.jar | head -1)"
CP="$JAR:$(cat "$WORK/cp.txt")"

note "Eingaben aus der Pfizer-Referenz und den Testdaten"
python3 "$TOOLS/make_inputs.py" "$SOURCE" "$WORK"

JAVA=(java -Duser.timezone=UTC -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP")
note "Referenz-XML mit dem Java-Code"
"${JAVA[@]}" "$TOOLS/ReferenceXml.java" "$WORK/testanlage.input.json" "$OUT/testanlage.raw.xml" "$OUT/testanlage.xml"
"${JAVA[@]}" "$TOOLS/ReferenceXml.java" "$WORK/pfizer.input.json" "$WORK/pfizer.raw.xml" "$WORK/pfizer.xml"
"${JAVA[@]}" "$TOOLS/TimelineProbe.java" > "$OUT/timeline.json"
cp "$WORK/testanlage.input.json" "$OUT/"
gzip -9 -n -c "$WORK/pfizer.input.json" > "$OUT/pfizer.input.json.gz"
gzip -9 -n -c "$WORK/pfizer.xml" > "$OUT/pfizer.xml.gz"
note "Geschrieben nach test/reportxml; pruefen mit: npm test"
