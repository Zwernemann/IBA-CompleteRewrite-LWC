# Datenmodell

Alle Objekte liegen im Namespace `mzw`; in der Org heissen sie `mzw__DIBA_Row__c` usw.
Die Spalten der Tomcat-Fassung (`IBA-Salesforce/iba-core/src/main/resources/db/migration`)
sind in den Feldbeschreibungen genannt.

| Objekt | Tomcat-Fassung | Inhalt |
|---|---|---|
| `DIBA_Account__c` (DIBA Account Data) | `iba_account.account` | ein Datensatz je Account, Schluessel `Account_Key__c` = Account-Id der Lieferung; Lookup auf den Account, wenn es ihn in der Org gibt; Voreinstellungen Sprache und finaler Report |
| `DIBA_Row__c` | `iba_account.device_row` | eine Zeile je Messstelle und Geraet, Schluessel `Row_Key__c` = Account-Id/Tag-Id/Asset-Id; Stammdaten, Beratereingaben, berechnete Werte, `Version__c` fuer das Sperren |
| `DIBA_Transmission__c` | `iba_account.transmission` | ein Datensatz je Teil einer Lieferung, mit Pruefsumme des Inhalts |
| `DIBA_Report_Value__c` | `iba_account.report_value` | ein Reporttext oder eine Reporteinstellung als JSON, mit Version |
| `DIBA_Master_Edit__c` | `iba_account.master_data_edit` | vom Berater geaendertes Stammdatenfeld einer Zeile, mit dem Salesforce-Wert beim Aendern |
| `DIBA_Interval_Value__c` | `iba_account.interval_value` | fuer einen Account geaenderte Zelle der Intervalltabelle |
| `DIBA_Interval__mdt` (Custom Metadata) | `ibacer.intervaltable` | die 90 Vorgaben von E+H je SPK, unveraendert uebernommen |
| `DIBA_Setting__mdt` (Custom Metadata) | `IBA_ORDERCODE_TRANSFORMER_URL` u. a. | Einstellungen, die ein Admin nach der Installation aendern darf |
| Salesforce Files mit `ContentVersion.DIBA_Slot__c` | `iba_account.attachment` | Logo (0) und PDFs nach den Kapiteln (1 bis 6) an den DIBA-Daten des Accounts |

Alle Objekte ausser `DIBA_Account__c` haengen per Master-Detail daran (die Bearbeitungen an
der Zeile): wird der Datensatz eines Accounts geloescht, gehen seine Daten mit. Sichtbar ist alles fuer alle mit
dem Permission Set, wie in der Tomcat-Fassung vereinbart.

## Abweichungen von der Tomcat-Fassung

- **`device_oid`** ist der Datensatzname von `DIBA_Row__c` (Auto Number). Er wird beim
  Anlegen vergeben und aendert sich nie.
- **Ja/Nein-Felder** sind Kontrollkaestchen. "Nicht gesendet" und "Nein" fallen zusammen;
  der Report unterschied sie schon bisher nicht.
- **Bemerkungen** (`Add_Remark1__c` bis 3) sind lange Textfelder; die uebrigen Texte
  haben hoechstens 255 Zeichen, wie bisher.
- **Der Account** wird nicht kopiert: `DIBA_Account__c` haelt nur Name und Laendercode aus der
  Lieferung und verweist auf den Account der Org.
- **Anhaenge** (Logo, PDFs) sind Salesforce Files an den DIBA-Daten des Accounts, kein eigenes Objekt.
- **`Order_Code_Pending__c`** ist neu: die Zeilen, deren Nachfolger der Order Code
  Transformer noch nachschlagen muss.
- **`PRODUCTSTATUS.*`** und **`ibacer.logging`** sind nicht uebernommen: das eine wird im
  Code der Tomcat-Fassung nicht gelesen, das andere kommt mit der Report-Erzeugung.

## Speicher

Ein Datensatz zaehlt in Salesforce pauschal rund 2 KB Data Storage (nicht nachgesehen).
Eine Anlage mit 50.000 Zeilen belegt damit rund 100 MB, die Pfizer-Anlage (2.358 Zeilen)
rund 5 MB.
