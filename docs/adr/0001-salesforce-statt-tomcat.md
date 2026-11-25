# 0001 Salesforce statt Tomcat

Stand: 2026-11-25, angenommen

## Kontext

Die Fassung in `Zwernemann/IBA-Salesforce` laeuft als Java-Anwendung auf Tomcat 10.1 mit
PostgreSQL. Salesforce liefert die Anlagendaten per HTTP, der Berater oeffnet die
Anwendung als Canvas-App oder per Link, der Report geht als File zurueck. Dafuer braucht es
einen Server, drei Anmeldeverfahren und den Betrieb bei E+H.

Der CRGenerator fuer LWC (`Zwernemann/realreports`) setzt die vorhandenen 51
Crystal-Vorlagen im Browser, mit dem Report-XML von heute als Eingabe. Er lohnt sich fuer
E+H nur, wenn auch Daten und Oberflaeche in Salesforce liegen.

## Entscheidung

Neubau als Salesforce-Paket in einem eigenen Repository:

- Daten in eigenen Objekten (`docs/datenmodell.md`).
- Dateneingang ueber die globale Apex-Methode `mzw.DibaImport.accept` mit dem JSON nach
  Schema v3. Die Aktion von E+H ruft sie statt des HTTP-Aufrufs auf; das Paket braucht die
  Objekte von E+H nicht zu kennen.
- Oberflaeche als LWC, Report-XML im Browser, Report ueber den CRGenerator.
- Jeder Stand als Unlocked Package mit Installationslink; Tests in Orgs laufen in der CI.

Die riskanten Teile kommen zuerst (Schritt 2 im README): die grosse Tabelle und der Weg
zum Report mit einer grossen Testanlage. Danach ist klar, ob grosse Anlagen ganz in
Salesforce gehen oder einen Render-Dienst brauchen.

## Folgen

- Kein Server, kein Canvas, keine eigenen Anmeldeverfahren mehr.
- Grenzen von Salesforce gelten: Apex-Heap, Zeilen je Transaktion, Speicher je Datensatz.
  Fuer den Dateneingang beschreibt `docs/dateneingang.md`, was daraus folgt.
- IBA-Salesforce bleibt in Betrieb, bis diese Fassung sie abloest, und wird dann Archiv.

## Offen

- Leistung des Reports im Browser bei grossen Anlagen (Pfizer: 2.358 Zeilen, rund 88 s im
  normalen Browser laut realreports).
- Speichern grosser PDFs als File aus einer LWC.
- Data Storage der Org bei vielen grossen Anlagen (rund 2 KB je Zeile).
