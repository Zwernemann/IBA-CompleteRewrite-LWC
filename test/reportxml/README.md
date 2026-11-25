# Referenzen des Report-XML

Das Report-XML ist der Vertrag mit den 51 Crystal-Vorlagen. `c/dibaReportXml` baut es im
Browser; die Jest-Tests vergleichen es Zeichen fuer Zeichen mit diesen Dateien, die der
Java-Code von IBA-Salesforce selbst geschrieben hat (`DeviceDataMapper`,
`ReportXmlFields`, JAXB mit formatierter Ausgabe, `FineTuneWriter`).

| Datei | Inhalt |
|---|---|
| `testanlage.input.json` | die 20 Zeilen der Testanlage mit Beratereingaben, Sonderzeichen, HTML in Reporttexten und Zeitleiste |
| `testanlage.raw.xml` | was JAXB daraus schreibt |
| `testanlage.xml` | dasselbe nach `FineTuneWriter`, wie es der CRGenerator bekommt |
| `pfizer.input.json.gz` | die Pfizer-Anlage (2.358 Zeilen), zurueckgelesen aus der Referenz in `crgen-iba/src/test/resources/goldenmaster/pfizer` |
| `pfizer.xml.gz` | das XML, das IBA-Salesforce daraus schreibt |
| `timeline.json` | Zellen der Zeitleiste und was Jsoup daraus macht |

Neu erzeugen, wenn sich der Java-Code aendert:

```bash
scripts/reference-xml.sh ../IBA-Salesforce
```

Erwartet: drei Schritte ohne Fehler, danach `npm test` gruen. Weichen die Dateien danach
ab, hat sich der Vertrag geaendert; das gehoert begruendet in einen eigenen Commit.

Die Eingaben enthalten nur Zeilen und Werte, wie sie die Anwendung haelt; Ersatznummern,
Intervalle und Produktstatusdaten rechnen beide Seiten selbst aus. Die Daten im Seitenkopf
(`psl_*`) schreibt Java in der Zeitzone des Servers; die Referenzen sind in UTC erzeugt,
wie der Server von IBA-Salesforce laeuft.
