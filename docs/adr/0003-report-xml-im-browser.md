# 0003 Report-XML im Browser, abgesichert gegen den Java-Code

Stand: 2026-11-25, angenommen

## Kontext

Das Report-XML ist der Vertrag mit den 51 Crystal-Vorlagen (IBA-Salesforce ADR 0004). Der
CRGenerator fuer LWC nimmt es im Browser entgegen. Apex kann es nicht bauen: eine grosse
Anlage ergibt ueber 100 MB, der Heap hat 6 bzw. 12 MB.

## Entscheidung

`c/sfibaReportXml` baut das XML im Browser aus den Zeilen, Texten, Einstellungen und der
Intervalltabelle: Felder wie `DeviceDataMapper` und `ReportXmlFields`, Ausgabe wie JAXB,
Zeitleiste wie Jsoup, danach der `FineTuneWriter`. Die Referenzen fuer die Tests schreibt
der Java-Code von IBA-Salesforce selbst (`scripts/reference-xml.sh`): die Testanlage und die
Pfizer-Anlage mit 2.358 Zeilen, Zeichen fuer Zeichen gleich.

## Folgen

- Eine Aenderung am Vertrag zeigt sich als roter Test, nicht erst im Report.
- SHA-256 und Ausgabe arbeiten mit einfachen Arrays und Zeichenketten, weil typisierte
  Arrays unter LWS um ein Vielfaches langsamer sind (realreports `docs/SALESFORCE.md` §7).
- 50.000 Zeilen brauchen in Node rund 3 s; in der Org ist das noch zu messen.
