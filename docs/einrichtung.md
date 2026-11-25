# Einrichtung der CI

Einmalig. Danach baut jeder Push die Pakete, ohne dass jemand `sf` aufruft.

Beteiligt sind zwei Orgs:

| Org | Wozu | Art |
|---|---|---|
| **Dev Hub** | baut die Paketversionen, legt Scratch Orgs an | die Org, mit der der Namespace `mzw` verknuepft ist (dieselbe wie fuer den CRGenerator) |
| **Test-Org** | jede freigegebene Version wird dort als Upgrade installiert und mit der Testanlage geprueft | eine Developer Edition; eine Sandbox ginge auch |

Die CI meldet sich an beiden ueber den JWT-Bearer-Flow an: ein Schluessel, dessen
Zertifikat in einer External Client App der Org liegt.

## 1. Schluessel erzeugen

```bash
scripts/jwt-setup.sh devhub
```

```bash
scripts/jwt-setup.sh testorg
```

Erwartet: je eine `.key`- und `.crt`-Datei unter `config/`, nicht im Repository.

## 2. External Client App in jeder der beiden Orgs

Einmal in der Oberflaeche der Org (Setup, External Client App Manager, New):

- Name: `DIBA CI`, Kontakt-E-Mail beliebig.
- OAuth aktivieren, Callback-URL `http://localhost:1717/OauthRedirect`.
- Scopes: "Manage user data via APIs (api)", "Perform requests at any time
  (refresh_token, offline_access)", "Manage user data via Web browsers (web)".
- "Enable JWT Bearer Flow" an, das Zertifikat aus Schritt 1 hochladen
  (`config/devhub.crt` bzw. `config/testorg.crt`).
- Policies: "Admin approved users are pre-authorized", dann unter "Select Profiles" das
  Profil des CI-Benutzers (System Administrator) eintragen.
- Den Consumer Key notieren.

## 3. Secrets in GitHub

Repository, Settings, Secrets and variables, Actions, New repository secret:

| Secret | Wert |
|---|---|
| `SF_DEVHUB_USERNAME` | Benutzername im Dev Hub |
| `SF_DEVHUB_CLIENT_ID` | Consumer Key der App im Dev Hub |
| `SF_DEVHUB_JWT_KEY` | Inhalt von `config/devhub.key` |
| `SF_TESTORG_USERNAME` | Benutzername in der Test-Org |
| `SF_TESTORG_CLIENT_ID` | Consumer Key der App in der Test-Org |
| `SF_TESTORG_JWT_KEY` | Inhalt von `config/testorg.key` |
| `SF_TESTORG_LOGIN_URL` | nur bei einer Sandbox: `https://test.salesforce.com` |

Danach die `.key`-Dateien loeschen oder sicher ablegen.

Ohne die Secrets laufen die Pruefungen trotzdem; Paketbau und Org-Tests werden mit einem
Hinweis uebersprungen.

## 4. Pakete anlegen

Actions, Workflow "CI", "Run workflow", Aufgabe "Pakete anlegen". Der Lauf legt "DIBA
Report" und "DIBA Test Data" im Dev Hub an und schreibt ihre Ids (`0Ho...`) in die
Zusammenfassung. Diese Ids kommen in `sfdx-project.json` unter `packageAliases`, als
Commit. Ab dann baut jeder Push die Pakete.

## Kontingente

Ein Dev Hub darf nur eine begrenzte Zahl Paketversionen und Scratch Orgs am Tag anlegen
(Zahlen nicht nachgesehen). Deshalb: Paketversionen bei jedem Push, Scratch Org nur bei
einem Tag `v*`.

## Nach der Installation in einer Org

Alles andere bringt der Installer mit: Objekte, Schaltflaeche, Tab, Permission Sets,
Remote Site und Einstellungen. Zwei Dinge haengen an der Org und ihren Benutzern; ein
Unlocked Package kann sie nicht setzen, weil es kein Skript nach der Installation ausfuehren
darf (das koennen nur Managed Packages):

1. **Schaltflaeche am Account.** Setup, Object Manager, Account, Page Layouts, das Layout
   der Berater, "Mobile & Lightning Actions", **DIBA Report** in den Bereich "Salesforce
   Mobile and Lightning Experience Actions" ziehen, speichern. Arbeitet die Account-Seite mit
   Dynamic Actions, stattdessen im Lightning App Builder die Aktion hinzufuegen.
2. **Permission Sets.** **DIBA Report Consultant** den Beratern, **DIBA Data Sender** dem
   Benutzer der E+H-Aktion. Gibt es bei E+H eine Permission Set Group fuer die Berater,
   genuegt es, DIBA Report Consultant dort aufzunehmen.

In der Test-Org und der Scratch Org der CI weist `scripts/org-install-test.sh` die
Permission Sets selbst zu; die Ende-zu-Ende-Tests oeffnen die Arbeitsflaeche ueber den Tab,
nicht ueber die Schaltflaeche.
