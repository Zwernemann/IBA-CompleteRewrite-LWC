# Architekturentscheidungen

| Nr. | Titel | Stand |
|---|---|---|
| 0001 | Salesforce statt Tomcat | angenommen |
| 0002 | Oberflaeche: eigenes Grid und eigener Texteditor | angenommen |
| 0003 | Report-XML im Browser, abgesichert gegen den Java-Code | angenommen |
| 0004 | Order Code Transformer aus Apex | angenommen |

Offen:

- CRGenerator fuer LWC: PDF-Anhaenge in den Report einfuegen (braucht eine Erweiterung im
  CRGenerator), Report als File ablegen. Angebunden ist er: Paketabhaengigkeit auf
  "CRGenerator" mit derselben Hauptversion (`scripts/dependencies-resolve.sh` nimmt beim Bau
  die neueste freigegebene), Schaltflaeche "Create report" mit `downloadPdf` und dem
  Katalogeintrag "IBA Report".
- Uebernahme bestehender Accounts aus IBA-Salesforce, falls E+H dort schon arbeitet.
