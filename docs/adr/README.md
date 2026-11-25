# Architekturentscheidungen

| Nr. | Titel | Stand |
|---|---|---|
| 0001 | Salesforce statt Tomcat | angenommen |
| 0002 | Oberflaeche: eigenes Grid und eigener Texteditor | angenommen |
| 0003 | Report-XML im Browser, abgesichert gegen den Java-Code | angenommen |
| 0004 | Order Code Transformer aus Apex | angenommen |

Offen:

- Anbindung des CRGenerators fuer LWC: Paketabhaengigkeit, Erzeugung mit `renderPdf`,
  PDF-Anhaenge in den Report einfuegen, Report als File ablegen.
- Uebernahme bestehender Accounts aus IBA-Salesforce, falls E+H dort schon arbeitet.
