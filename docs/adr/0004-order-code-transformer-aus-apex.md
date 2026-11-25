# 0004 Order Code Transformer aus Apex

Stand: 2026-11-25, angenommen

## Kontext

IBA-Salesforce fragt den Order Code Transformer von E+H nach jeder Lieferung fuer die
geschriebenen Zeilen und sofort, wenn ein Berater einen Bestellcode aendert. In Salesforce
darf ein Callout nicht nach DML in derselben Transaktion kommen, und ein Queueable darf nur
einen weiteren starten.

## Entscheidung

- Eine Lieferung markiert ihre Zeilen (`SFIBA_Order_Code_Pending__c`) und startet
  `SfibaOrderCodeJob`, ausser sie laeuft selbst schon asynchron; dann bleibt das dem
  Aufrufer (die Lasttestanlage startet den Job nach ihrem letzten Teil).
- Der Job arbeitet in Laeufen zu 2.000 Zeilen, bis zu 500 Codes je Callout. Ist der Dienst
  nicht erreichbar, bleiben die Zeilen markiert.
- Adresse als Custom Metadata `SFIBA_Setting`, Remote Site im Paket; keine Named
  Credential, der Dienst braucht keine Anmeldung.

## Folgen

- Der Dienst muss aus Salesforce erreichbar sein; mit E+H zu bestaetigen.
- Ein gefundener Nachfolger erhoeht die Version der Zeile; arbeitet gleichzeitig ein Berater
  an ihr, bekommt er den ueblichen Hinweis auf die geaenderte Zeile.
