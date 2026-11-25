# DIBA Report Generator in Salesforce

Der DIBA Report Generator fuer Endress+Hauser als Salesforce-Paket: Anlagendaten,
Beratereingaben, Oberflaeche und Report laufen in der Org, ohne eigenen Server.
Nachfolger der Tomcat-Fassung `Zwernemann/IBA-Salesforce`.

## Stand

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Datenmodell, Dateneingang `mzw.DibaImport`, Intervalltabelle, Permission Sets, CI mit Installer | dieser Stand |
| 2 | Wartungsdialog als Tabelle in LWC, Report-XML, Report ueber den CRGenerator, Ablage als File | offen |
| 3 | uebrige Dialoge, Reporttexte, Order Code Transformer, Anhaenge | offen |

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

## Dokumentation

- `docs/einrichtung.md`: Dev Hub, Test-Org und Secrets der CI, einmalig.
- `docs/dateneingang.md`: wie E+H die Anlagendaten liefert.
- `docs/datenmodell.md`: Objekte und Felder, Zuordnung zur Tomcat-Fassung.
- `docs/entwicklung.md`: Aufbau des Repositorys, Pruefungen, Versionen.
- `docs/adr/`: Architekturentscheidungen.
