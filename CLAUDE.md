# Projektregeln

## Was dieses Projekt ist

DIBA Report Generator fuer Endress+Hauser, neu gebaut als Salesforce-Paket: Datenhaltung,
Oberflaeche (LWC) und Logik laufen in der Org von E+H, kein eigener Server. Ausgeliefert
wird jeder Stand als **Unlocked Package im Namespace `mzw`** mit Installationslink, gebaut
von der CI. Den Report erzeugt der CRGenerator fuer LWC (`Zwernemann/realreports`,
`apps/salesforce`), ein eigenes Paket im selben Namespace.

Quellen, beide **read-only**, nichts wird dorthin zurueckgeschrieben:

- `Zwernemann/IBA-Salesforce`: die heutige Fassung (Tomcat, JSF, PostgreSQL). Fachlogik,
  Report-XML, Golden Master und Testdaten kommen von dort.
- `Zwernemann/realreports`: der CRGenerator fuer LWC.

Warum so: `docs/adr/0001-salesforce-statt-tomcat.md`.

## Harte Randbedingungen

- **Alles kommt als Paket in die Org.** Kein `sf project deploy` und keine Klicks in einer
  Org, um etwas zu testen. Jede Aenderung muss so gebaut sein, dass die CI daraus eine
  Paketversion baut und in einer Org automatisch prueft.
- **Keine Zugangsdaten im Repository.** Schluessel und Benutzer fuer Dev Hub und Test-Org
  liegen als GitHub Secrets (`docs/einrichtung.md`). `config/*.key` ist ausgeschlossen.
- **Keine festen Verweise auf Objekte von E+H.** Die Anlagendaten kommen als JSON nach
  Schema v3 ueber `mzw.DibaImport.accept` (`docs/dateneingang.md`). Das Schema unter
  `docs/schema/` ist der Vertrag mit E+H und wird nicht ohne Abstimmung geaendert.
- **Der XML-Vertrag zum CRGenerator bleibt**, wie in IBA-Salesforce ADR 0004: das Report-XML
  muss gegen die Golden-Master-Dateien gleich sein oder die Abweichung ist begruendet.
- **Globale Apex-Schnittstellen sind endgueltig.** Was `global` ist, laesst sich aus einer
  freigegebenen Paketversion kaum wieder entfernen. Neue `global`-Elemente nur bewusst und
  in `docs/dateneingang.md` beschrieben.
- **Namespace `mzw` teilen sich dieses Paket und der CRGenerator.** Eigene Bausteine
  beginnen mit `DIBA_` (Objekte, Permission Sets) oder `diba`/`Diba` (Apex, LWC).

## Arbeitsweise

- Vor dem Commit `npm run check:apex`, `npm run check:metadata` und
  `node scripts/generate-permissionsets.mjs --check`. Die CI prueft dasselbe.
- **Jeder Commit, der ein Paket aendert, erhoeht dessen `versionNumber`** in
  `sfdx-project.json` (`force-app` ist "DIBA Report", `eh-emulation` ist "DIBA Test
  Data"): mittlere Stelle fuer eine neue Funktion, die ein Nutzer bemerkt, letzte fuer alles
  andere, erste bei einem Bruch der Schnittstelle. Die CI prueft es
  (`scripts/check-version.sh`); ohne neue Nummer laesst sich eine Version nicht freigeben.
- Neue Felder: Datei unter `objects/<Objekt>/fields/`, Elemente in der Reihenfolge
  `fullName`, dann alphabetisch, mit Beschreibung. Danach
  `node scripts/generate-permissionsets.mjs`.
- Apex mit Tests; die Paketversion braucht 75 % Abdeckung zur Freigabe.
- **Code, Bezeichner, Kommentare und Protokollmeldungen auf Englisch.** Deutsch bleiben die
  Dokumentation unter `docs/` und die Ausgaben der Skripte. Texte einer Schnittstelle
  (Fehlermeldungen des Dateneingangs, XML an den CRGenerator) nicht aendern.
- Keine Umlaute in Dateinamen.
