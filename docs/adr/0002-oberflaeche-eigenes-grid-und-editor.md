# 0002 Oberflaeche: eigenes Grid und eigener Texteditor

Stand: 2026-11-25, angenommen

## Kontext

Die Tabellendialoge muessen Anlagen mit 50.000 Zeilen bearbeiten: Zellbearbeitung, Filter
und Sortierung je Spalte. `lightning-datatable` zeichnet alle geladenen Zeilen und hat
keine Spaltenfilter. Die Reporttexte bestehen aus HTML mit Farben, Schriftgroessen und
`font`-Tags, das der CRGenerator unveraendert in den Report setzt; IBA-Salesforce hat
deshalb die Filter von SunEditor abgeschaltet. `lightning-input-rich-text` formt HTML in
sein eigenes Format um.

## Entscheidung

- `c/dibaGrid`: eigene Tabelle, die nur die sichtbaren Zeilen zeichnet. Filtern, Sortieren
  und das Fenster stecken in `c/dibaGridModel` und sind ohne Oberflaeche getestet, auch mit
  50.000 Zeilen.
- `c/dibaRichText`: ein `contenteditable`-Bereich mit Fett, Kursiv, Unterstrichen wie
  bisher. Das HTML bleibt, wie es ist; nur die Attribute `lwc-*`, die das synthetische
  Shadow DOM einfuegt, werden beim Lesen entfernt.
- Keine Bibliotheken von Dritten: unter Lightning Web Security waere ihr Verhalten erst zu
  pruefen, und jede ist eine Static Resource mehr.

## Folgen

- Excel-Export entfaellt (abgesprochen).
- Mehrzeilige Spaltenkoepfe der alten Intervalltabelle gibt es nicht; die Spalten heissen
  "Wartungsintervalle in Monaten: hoch / normal" usw.
- Verhalten unter LWS in einer echten Org ist erst mit den Ende-zu-Ende-Tests belegt.
