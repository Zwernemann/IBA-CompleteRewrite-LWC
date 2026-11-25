# Entwicklung

## Aufbau

| Pfad | Inhalt |
|---|---|
| `force-app/` | Paket **DIBA Report**: Objekte, Apex, LWC, Tab, Custom Metadata, Permission Sets |
| `eh-emulation/` | Paket **DIBA Test Data**: Testanlage als Static Resources, `mzw.DibaTestData.send` liefert sie ueber den Dateneingang; `mzw.DibaLargePlant.start` liefert eine erfundene Anlage beliebiger Groesse in Teilen. Nur fuer Test-Orgs |
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
| Push auf einen Branch | ja | Beta, Links in der Zusammenfassung | nein |
| Push auf `main` | ja | freigegeben | Upgrade in der Test-Org, Testanlage liefern, 20 Zeilen pruefen |
| Tag `v*` | ja | freigegeben | Erstinstallation in einer neuen Scratch Org |

Beim Bau einer Paketversion laufen alle Apex-Tests des Pakets. Ohne 75 % Abdeckung laesst
sich die Version nicht freigeben.

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
| `dibaReport` | der Tab: Liste der Anlagen, `?c__account=` oeffnet eine direkt |
| `dibaPlant` | eine Anlage mit den sieben Reitern der bisherigen Arbeitsseite |
| `dibaMaintenanceModal` | die Anlagentabelle als Dialog ueber den ganzen Bildschirm |
| `dibaMaintenance` | laedt die Zeilen seitenweise (2.000 je Aufruf), prueft und speichert Aenderungen (500 Zeilen je Aufruf) |
| `dibaGrid` | die Tabelle: zeichnet nur die sichtbaren Zeilen, Filter und Sortierung je Spalte, Bearbeiten per Klick |
| `dibaGridModel`, `dibaRowLogic` | Logik ohne Oberflaeche: Filtern, Sortieren, Fenster; Stammdatenaenderungen, Wartungsrisiko, Obsoleszenz wie in IBA-Salesforce |

Die Zeilen kommen von `DibaPlantController` mit den Elementnamen des Report-XML als
Schluessel (`DibaRowFields`), damit die Komponenten keine Feldnamen mit Namespace sehen.
Stammdaten aendert der Berater nie direkt, sondern als `DIBA_Master_Edit__c` neben dem
Salesforce-Wert, wie bisher. Wartungsrisiko und Obsoleszenz rechnet der Browser beim
Laden; gespeichert werden sie mit der naechsten Aenderung der Zeile.

## Lasttest

In einer Test-Org mit DIBA Test Data:

```bash
sf apex run --file scripts/apex/send-large.apex --target-org <Alias>
```

Erwartet: eine Lieferungskennung `LASTTEST-...`; danach kommen 50 Teile zu je 1.000 Zeilen
nacheinander an. Eine Developer Edition hat dafuer zu wenig Speicher (rund 100 MB noetig,
nicht nachgesehen); eine Scratch Org reicht.
