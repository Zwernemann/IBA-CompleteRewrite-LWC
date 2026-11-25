# Einrichtung und erste Installation

Alles geht im Browser. Einmalig wird ein Schluessel erzeugt (in einem GitHub Codespace),
danach baut GitHub die Installer selbst.

Beteiligt sind:

| Was | Wozu |
|---|---|
| **Dev Hub** | die Org, mit der der Namespace `mzw` verknuepft ist (dieselbe wie fuer den CRGenerator); baut die Paketversionen |
| **Ziel-Org** | wo installiert wird: eine Sandbox, eine Developer Edition oder spaeter E+H |
| **GitHub** | haelt den Schluessel als Secret und baut bei jedem Push oder auf Knopfdruck |

## 1. Schluessel erzeugen (Codespace, einmalig)

1. Im Repository auf GitHub: **Code**, Reiter **Codespaces**, **Create codespace on
   claude/gifted-johnson-2lve4o** (oder auf dem Branch, auf dem gearbeitet wird).
2. Im Terminal unten:

   ```bash
   scripts/jwt-setup.sh devhub
   ```

   Erwartet: zwei Dateien `config/devhub.crt` und `config/devhub.key`.
3. Links im Explorer `config/devhub.crt` rechts anklicken, **Download**. Diese Datei kommt
   in Schritt 2 nach Salesforce.
4. Den privaten Schluessel anzeigen und ganz kopieren (von `-----BEGIN` bis `-----END
   PRIVATE KEY-----` einschliesslich):

   ```bash
   cat config/devhub.key
   ```

   Er kommt in Schritt 3 nach GitHub. Danach den Codespace loeschen (GitHub, Codespaces,
   "..." am Codespace, Delete); der Schluessel verschwindet mit ihm.

## 2. External Client App im Dev Hub (einmalig)

Im Dev Hub: **Setup**, Suche "External Client App Manager", **New External Client App**.

- Name `DIBA CI`, API-Name `DIBA_CI`, Kontakt-E-Mail beliebig, Distribution State **Local**.
- **Enable OAuth**: Callback URL `http://localhost:1717/OauthRedirect`.
- OAuth Scopes: "Manage user data via APIs (api)", "Perform requests at any time
  (refresh_token, offline_access)", "Manage user data via Web browsers (web)".
- **Enable JWT Bearer Flow**, das Zertifikat `devhub.crt` aus Schritt 1 hochladen.
- Speichern.
- Reiter **Policies**, **Edit**: Permitted Users **Admin approved users are
  pre-authorized**; darunter das Profil **System Administrator** auswaehlen. Speichern.
- Reiter **Settings**, **Consumer Key and Secret**: den **Consumer Key** kopieren.

Die Bezeichnungen im Setup aendern sich gelegentlich; gemeint ist jeweils dasselbe.

## 3. Secrets in GitHub (einmalig)

Repository, **Settings**, **Secrets and variables**, **Actions**, **New repository secret**,
dreimal:

| Name | Wert |
|---|---|
| `SF_DEVHUB_USERNAME` | dein Benutzername im Dev Hub |
| `SF_DEVHUB_CLIENT_ID` | der Consumer Key aus Schritt 2 |
| `SF_DEVHUB_JWT_KEY` | der private Schluessel aus Schritt 1 |

## 4. Installer bauen

Repository, **Actions**, Workflow **CI**, **Run workflow**, Branch waehlen, Aufgabe:

- **Installer bauen (Beta)**: laesst sich nur in Sandboxes und Scratch Orgs installieren.
- **Installer bauen und freigeben**: laesst sich ueberall installieren, auch in einer
  Developer Edition oder Produktion. Jede Versionsnummer laesst sich nur einmal freigeben.

Der Lauf dauert einige Minuten. Beim ersten Mal legt er die beiden Pakete im Dev Hub an.
Danach stehen in der Zusammenfassung des Laufs (Lauf oeffnen, ganz oben "Summary") je Paket
zwei Links: einer fuer Produktion und Developer Edition, einer fuer Sandboxes.

Ab dann baut auch jeder Push einen Beta-Installer; ein Push auf `main` gibt frei.

## 5. In die Ziel-Org installieren

1. In der Ziel-Org angemeldet den Link fuer **DIBA Report** oeffnen, "Install for Admins
   Only", installieren.
2. Fuer eine Test-Org zusaetzlich **DIBA Test Data** auf dieselbe Weise.

## 6. Nach der Installation

Zwei Dinge, die ein Unlocked Package nicht selbst setzen kann:

1. **Schaltflaeche am Account.** Setup, Object Manager, Account, Page Layouts, das Layout
   der Berater, "Mobile & Lightning Actions", **DIBA Report** in den Bereich "Salesforce
   Mobile and Lightning Experience Actions" ziehen, speichern. Arbeitet die Account-Seite mit
   Dynamic Actions, stattdessen im Lightning App Builder die Aktion hinzufuegen.
2. **Permission Sets.** Setup, Users, Benutzer oeffnen, Permission Set Assignments, Edit
   Assignments: **DIBA Report Consultant** fuer Berater, **DIBA Data Sender** fuer den
   Benutzer der E+H-Aktion.

## 7. Testdaten (nur Test-Org)

Developer Console (Zahnrad oben rechts), **Debug**, **Open Execute Anonymous Window**, den
Inhalt von `scripts/apex/send-testdata.apex` einfuegen, **Execute**. Erwartet: im Log
`DIBA-TEST-OK`; der Account "DIBA Testanlage Nord" hat dann 20 Zeilen. Am Account die
Schaltflaeche **DIBA Report** druecken.

## Spaeter: feste Test-Org fuer die CI

Fuer Upgrade- und Ende-zu-Ende-Tests bei jedem Push auf `main` dieselben Schritte 1 bis 3
mit `scripts/jwt-setup.sh testorg` in der Test-Org und den Secrets `SF_TESTORG_USERNAME`,
`SF_TESTORG_CLIENT_ID`, `SF_TESTORG_JWT_KEY` (bei einer Sandbox zusaetzlich
`SF_TESTORG_LOGIN_URL` = `https://test.salesforce.com`). Ohne diese Secrets entfallen die
Org-Tests mit einem Hinweis.

## Kontingente

Ein Dev Hub darf nur eine begrenzte Zahl Paketversionen und Scratch Orgs am Tag anlegen
(Zahlen nicht nachgesehen). Deshalb Scratch Orgs nur bei einem Tag `v*`.
