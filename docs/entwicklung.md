# Entwicklung

## Aufbau

| Pfad | Inhalt |
|---|---|
| `force-app/` | Paket **DIBA Report**: Objekte, Apex, Custom Metadata, Permission Sets |
| `eh-emulation/` | Paket **DIBA Test Data**: Testanlage als Static Resources, `mzw.DibaTestData.send` liefert sie ueber den Dateneingang. Nur fuer Test-Orgs |
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
npm run check:apex && npm run check:metadata && node scripts/generate-permissionsets.mjs --check
```

Erwartet: "All matched files use Prettier code style!", "Metadaten in Ordnung", keine
Ausgabe der letzten Pruefung. `check:apex` zerlegt jede Apex-Klasse und meldet
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
