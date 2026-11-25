# SF Frontend IBA in Salesforce

Der SF Frontend IBA fuer Endress+Hauser als Salesforce-Paket: Anlagendaten,
Beratereingaben, Oberflaeche und Report laufen in der Org, ohne eigenen Server.
Nachfolger der Tomcat-Fassung `Zwernemann/IBA-Salesforce`.

## Stand

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Datenmodell, Dateneingang `mzw.SfibaImport`, Intervalltabelle, Permission Sets, CI mit Installer | fertig |
| 2a | Tab "DIBA Report", Anlagentabelle (Wartungsdialog) als virtuelle Tabelle mit Filtern, Sortierung, Zellbearbeitung, Sperren bei gleichzeitiger Bearbeitung; Lasttestanlage | dieser Stand |
| 2b | Report-XML im Browser, zeichengleich mit IBA-Salesforce | fertig |
| 2c | Report ueber den CRGenerator, Ablage als File | offen, braucht die Versions-Id des CRGenerator-Pakets |
| 3a | Reiter mit Reporttexten (Vorlagen je Sprache, Seitenumbruch, Zuruecksetzen), Schieberegler, Reporteinstellungen, Speichern je Feld mit Version; Download des Report-XML | fertig |
| 3b | Dialoge Breakdown, Migration, Vorbeugung (mit berechneten Intervallen), Intervalltabelle des Accounts | fertig |
| 3c | Order Code Transformer (nach jeder Lieferung und beim Aendern des Bestellcodes), Anhaenge (Logo, sechs PDFs) | dieser Stand |

## Installieren

Jeder Push baut zwei Pakete und schreibt die Installationslinks in die Zusammenfassung des
CI-Laufs (Actions, Lauf oeffnen):

- **SF Frontend IBA**: die Anwendung. Fuer E+H.
- **SF Frontend IBA Test Data**: eine Testanlage, die ueber den Dateneingang geliefert wird. Nur fuer
  Test-Orgs, nie bei E+H.

Ein Push auf einen Branch ergibt eine Beta-Version, die sich nur in Sandboxes und Scratch
Orgs installieren laesst. Ein Push auf `main` gibt die Version frei und spielt sie als
Upgrade in die Test-Org ein; ein Tag `v*` prueft zusaetzlich die Erstinstallation in einer
leeren Scratch Org.

Nach der Installation bleiben zwei Handgriffe, die ein Unlocked Package nicht selbst
erledigen kann (`docs/einrichtung.md`, Abschnitt "Nach der Installation"):

1. Die Schaltflaeche **SF IBA Report** in das Seitenlayout des Accounts aufnehmen.
2. Permission Set **SF IBA Report Consultant** den Beratern zuweisen, **SF IBA Data Sender**
   dem Benutzer, unter dem die Aktion von E+H liefert. Die Adresse des
Order Code Transformers steht in der Custom Metadata **SF IBA Setting**
(`Order_Code_Transformer_URL`), die Remote Site `SFIBA_Order_Code_Transformer` kommt mit
dem Paket; beides nur aendern, wenn E+H eine andere Adresse nennt.

## Bedienen

Der Berater oeffnet am Account die Schaltflaeche **SF IBA Report**. Sie oeffnet die
Arbeitsflaeche dieses Accounts ganzseitig (`/lightning/n/mzw__SFIBA_Report?mzw__account=<Id>`);
der Pfeil oben links fuehrt zurueck zum Account. Aenderungen werden beim Tippen gespeichert.

## Dokumentation

- `docs/einrichtung.md`: Dev Hub, Test-Org und Secrets der CI, einmalig.
- `docs/dateneingang.md`: wie E+H die Anlagendaten liefert.
- `docs/datenmodell.md`: Objekte und Felder, Zuordnung zur Tomcat-Fassung.
- `docs/entwicklung.md`: Aufbau des Repositorys, Pruefungen, Versionen.
- `docs/adr/`: Architekturentscheidungen.
