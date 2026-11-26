# Entwicklung

## Aufbau

| Pfad | Inhalt |
|---|---|
| `force-app/` | Paket **SF Frontend IBA**: Objekte, Apex, LWC, Tab, Custom Metadata, Permission Sets |
| `eh-emulation/` | Paket **SF Frontend IBA Test Data**: Testanlage als Static Resources, `mzw.SfibaTestData.send` liefert sie ueber den Dateneingang; `mzw.SfibaLargeAccount.start` liefert einen erfundenen Account beliebiger Groesse in Teilen. Nur fuer Test-Orgs |
| `config/project-scratch-def.json` | Definition der Scratch Org fuer die Erstinstallation |
| `scripts/` | Paketbau, Anmeldung, Org-Tests, Pruefungen |
| `docs/schema/` | Schema v3 des Dateneingangs, Vertrag mit E+H |
| `.github/workflows/ci.yml` | die CI |

## Pruefen

Lokal, ohne Org:

```bash
npm ci
```

```bash
npm test && npm run check:apex && npm run check:metadata && node scripts/generate-permissionsets.mjs --check
```

Erwartet: alle Jest-Tests bestanden, "All matched files use Prettier code style!",
"Metadaten in Ordnung", keine Ausgabe der letzten Pruefung. `npm test` prueft die LWC
ohne Org, darunter das Grid mit 50.000 Zeilen. `check:apex` zerlegt jede Apex-Klasse und meldet
Syntaxfehler; uebersetzt und getestet wird Apex erst beim Paketbau in der CI.

## Was die CI tut

| Ereignis | Pruefungen | Paketversionen | Org-Test |
|---|---|---|---|
| Push auf `main` (andere Branches laufen nicht, damit derselbe Commit nicht doppelt geprueft wird) | ja | keine | nein |
| Run workflow, "Installer bauen (Beta)" | ja | Beta, Links in der Zusammenfassung | auf `main`: Upgrade in der Test-Org |
| Run workflow, "Installer bauen und freigeben" | ja | freigegeben | auf `main`: Upgrade in der Test-Org, Testanlage liefern, 21 Zeilen pruefen, Ende-zu-Ende-Tests |
| Tag `v*` | ja | freigegeben | Erstinstallation in einer neuen Scratch Org mit denselben Tests |

Paketversionen zaehlen gegen das Tageskontingent des Dev Hub und kosten Minuten in Actions.
Deshalb baut ein Push keine; ein neuer Push bricht die Pruefungen eines aelteren ab.

Beim Bau einer Paketversion laufen alle Apex-Tests des Pakets. Ohne 75 % Abdeckung laesst
sich die Version nicht freigeben.

## Ende-zu-Ende-Tests

`e2e/` mit Playwright: meldet sich ueber die Frontdoor-Adresse der Org an, oeffnet den Tab
mit der Testanlage, prueft Reiter und Tabelle, aendert eine Bemerkung und einen Reporttext
und prueft per Abfrage, dass beides gespeichert ist, und laedt das Report-XML. Die CI ruft
`scripts/e2e.sh` nach der Installation auf; bei einem Fehler liegt der Bericht als Artefakt
`e2e-report` am Lauf. Bis die Test-Org eingerichtet ist, sind diese Tests noch nie gegen eine
echte Org gelaufen; die Selektoren koennen beim ersten Lauf Nacharbeit brauchen.

## Versionen

`versionNumber` in `sfdx-project.json`, je Paket. Jeder Commit, der ein Paket aendert,
erhoeht dessen Nummer; die vierte Stelle (`NEXT`) zaehlt Salesforce beim Bau selbst hoch.
Eine Nummer `major.minor.patch` laesst sich nur einmal freigeben.

## Neue Felder

1. Datei unter `force-app/main/default/objects/<Objekt>/fields/` anlegen, mit Beschreibung.
2. `node scripts/generate-permissionsets.mjs`
3. Version erhoehen.

## Oberflaeche

| Komponente | Aufgabe |
|---|---|
| `sfibaOpenReport` | die Schaltflaeche "SF IBA Report" am Account (Quick Action): oeffnet den Tab fuer diesen Account |
| `sfibaReport` | der Tab: die Arbeitsflaeche des Accounts aus `mzw__account`; ohne Account ein Hinweis, wie er geoeffnet wird |
| `sfibaAccount` | die DIBA-Daten eines Accounts mit den sieben Reitern: Schieberegler, Reporttexte je Kapitel, Reporteinstellungen, Download des Report-XML, Report als PDF ueber den CRGenerator (`c/crgenerator`, in Jest eine Attrappe unter `jest-mocks/`) mit Fortschritt ueber den Reitern, Report-XML als File "IBA Report XML" am Account (bis 2 MB, jede Ablage eine neue Version); speichert waehrend der Arbeit |
| `sfibaReportProgress` | macht aus den Ereignissen des CRGenerators die Fortschrittsanzeige: welcher Teil des virtuellen Reports laeuft, Phase, Seite, Seiten und Datensaetze bisher, Zeit |
| `sfibaRichText` | Editor eines Reporttexts; laesst das HTML der Vorlagen unveraendert, Fett, Kursiv, Unterstrichen wie bisher |
| `sfibaReportSettingsModal` | die Reporteinstellungen |
| `sfibaReportState` | Vorlagen je Reportsprache, Sprachwechsel, Speichern je Feld mit Version, wie `ReportTemplates`, `ReportState` und `ReportValuesSession` |
| `sfibaAttachment` | ein Anhang: Logo (PNG wird im Browser zu JPEG auf weissem Grund) oder PDF nach einem Kapitel, als Salesforce File an den DIBA-Daten des Accountse |
| `sfibaRowStore`, `sfibaTexts` | Zeilen eines Accounts und Uebersetzungen, je Seite einmal geladen und geteilt |
| `sfibaMaintenanceModal` | die Tabellendialoge als Dialog ueber den ganzen Bildschirm |
| `sfibaMaintenance` | die vier Tabellendialoge (Assets, Breakdown, Migration, Vorbeugung) mit den Spalten aus `sfibaColumns`; prueft und speichert Aenderungen (500 Zeilen je Aufruf) |
| `sfibaIntervalModal` | die Intervalltabelle des Accounts: Vorgaben von E+H mit den Aenderungen des Accounts, Zelle fuer Zelle gespeichert |
| `sfibaGrid` | die Tabelle: zeichnet nur die sichtbaren Zeilen, Filter und Sortierung je Spalte, Bearbeiten per Klick |
| `sfibaGridModel`, `sfibaRowLogic` | Logik ohne Oberflaeche: Filtern, Sortieren, Fenster; Stammdatenaenderungen, Wartungsrisiko, Obsoleszenz wie in IBA-Salesforce |
| `sfibaReportXml` | das Report-XML fuer den CRGenerator, Zeichen fuer Zeichen wie IBA-Salesforce es schreibt |

Die Zeilen kommen von `SfibaAccountController` mit den Elementnamen des Report-XML als
Schluessel (`SfibaRowFields`), damit die Komponenten keine Feldnamen mit Namespace sehen.
Stammdaten aendert der Berater nie direkt, sondern als `SFIBA_Master_Edit__c` neben dem
Salesforce-Wert, wie bisher. Wartungsrisiko und Obsoleszenz rechnet der Browser beim
Laden; gespeichert werden sie mit der naechsten Aenderung der Zeile.

## Report-XML

`c/sfibaReportXml` baut das XML aus den Zeilen der Tabelle, den Reporttexten, den
Einstellungen und der Intervalltabelle: Geraetefelder wie `DeviceDataMapper` und
`ReportXmlFields` (Ersatznummern aus SHA-256, Intervalle, Produktstatusdaten), die Zeitleiste
wie Jsoup, die Ausgabe wie JAXB, danach die Anpassungen des `FineTuneWriter`. Die Tests
vergleichen gegen Referenzen, die der Java-Code geschrieben hat, darunter die Pfizer-Anlage
mit 2.358 Zeilen; siehe `test/reportxml/README.md`. 50.000 Zeilen brauchen in Node rund
3 s und ergeben gut 100 MB XML.

## Order Code Transformer

`SfibaOrderCodes` fragt den Dienst von E+H nach den Nachfolgern alter Bestellcodes, bis zu
500 Codes je Aufruf. Eine Lieferung markiert ihre Zeilen (`SFIBA_Order_Code_Pending__c`) und
startet `SfibaOrderCodeJob`, der sie in Laeufen zu 2.000 Zeilen abarbeitet; ist der Dienst
nicht erreichbar, bleiben die Zeilen markiert. Aendert der Berater einen Bestellcode, fragt
die Tabelle sofort nach (`SfibaAccountController.lookupOrderCode`). Ein Nachfolger landet in
`add_ordercode_transform` und `add_recomend_ordercode` und erhoeht die Version der Zeile.

## Uebersetzungen

Oberflaeche und Vorlagen nehmen ihre Texte aus der Uebersetzungsbibliothek von E+H
(`trans-library`, Buendel `CR_ApplicationResources`), exportiert als Static Resource
`sfibaTranslations`. Die Oberflaeche spricht die Sprache des Salesforce-Benutzers, wo die
Bibliothek sie hat, sonst Englisch; Vorlagen und Report die Reportsprache. Neu exportieren:

```bash
scripts/export-translations.sh ../IBA-Salesforce
```

Erwartet: "Geschrieben", danach `npm test` gruen; die Tests vergleichen jede Vorlage in jeder
Sprache mit `ReportTemplates`.

## Lasttest

In einer Test-Org mit SF Frontend IBA Test Data:

```bash
sf apex run --file scripts/apex/send-large.apex --target-org <Alias>
```

Erwartet: eine Lieferungskennung `LASTTEST-...`; danach kommen 50 Teile zu je 1.000 Zeilen
nacheinander an. Eine Developer Edition hat dafuer zu wenig Speicher (rund 100 MB noetig,
nicht nachgesehen); eine Scratch Org reicht.
