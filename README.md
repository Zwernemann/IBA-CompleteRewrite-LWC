# DIBA Report Generator in Salesforce

Der DIBA Report Generator fuer Endress+Hauser als Salesforce-Paket: Anlagendaten,
Beratereingaben, Oberflaeche und Report laufen in der Org, ohne eigenen Server.
Nachfolger der Tomcat-Fassung `Zwernemann/IBA-Salesforce`.

## Stand

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Datenmodell, Dateneingang `mzw.DibaImport`, Intervalltabelle, Permission Sets, CI mit Installer | fertig |
| 2a | Tab "DIBA Report", Anlagentabelle (Wartungsdialog) als virtuelle Tabelle mit Filtern, Sortierung, Zellbearbeitung, Sperren bei gleichzeitiger Bearbeitung; Lasttestanlage | dieser Stand |
| 2b | Report-XML im Browser, zeichengleich mit IBA-Salesforce | fertig |
| 2c | Report ueber den CRGenerator, Ablage als File | offen, braucht die Versions-Id des CRGenerator-Pakets |
| 3a | Reiter mit Reporttexten (Vorlagen je Sprache, Seitenumbruch, Zuruecksetzen), Schieberegler, Reporteinstellungen, Speichern je Feld mit Version; Download des Report-XML | dieser Stand |
| 3b | Dialoge Breakdown, Migration, Vorbeugung, Intervalltabelle; Order Code Transformer; Anhaenge | offen |

## Installieren

Jeder Push baut zwei Pakete und schreibt die Installationslinks in die Zusammenfassung des
CI-Laufs (Actions, Lauf oeffnen):

- **DIBA Report**: die Anwendung. Fuer E+H.
- **DIBA Test Data**: eine Testanlage, die ueber den Dateneingang geliefert wird. Nur fuer
  Test-Orgs, nie bei E+H.

Ein Push auf einen Branch ergibt eine Beta-Version, die sich nur in Sandboxes und Scratch
Orgs installieren laesst. Ein Push auf `main` gibt die Version frei und spielt sie als
Upgrade in die Test-Org ein; ein Tag `v*` prueft zusaetzlich die Erstinstallation in einer
leeren Scratch Org.

Nach der Installation: Permission Set **DIBA Report Consultant** den Beratern zuweisen,
**DIBA Data Sender** dem Benutzer, unter dem die Aktion von E+H liefert.

## Bedienen

Der Berater oeffnet im App Launcher den Tab **DIBA Report**, waehlt eine Anlage und
oeffnet mit **Edit assets** die Anlagentabelle. Direkt zu einer Anlage fuehrt
`/lightning/n/mzw__DIBA_Report?c__account=<Account-Id>`, etwa aus einer Schaltflaeche am
Account. Aenderungen werden beim Tippen gespeichert.

## Dokumentation

- `docs/einrichtung.md`: Dev Hub, Test-Org und Secrets der CI, einmalig.
- `docs/dateneingang.md`: wie E+H die Anlagendaten liefert.
- `docs/datenmodell.md`: Objekte und Felder, Zuordnung zur Tomcat-Fassung.
- `docs/entwicklung.md`: Aufbau des Repositorys, Pruefungen, Versionen.
- `docs/adr/`: Architekturentscheidungen.
