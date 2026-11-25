# Dateneingang

Die Aktion "DIBA Report" von E+H baut die Anlagendaten eines Accounts als JSON nach
Schema v3 (`docs/schema/iba-import.schema.json`, unveraendert aus IBA-Salesforce). Bisher
schickte sie das JSON per HTTP an den Tomcat. Mit dem Paket ruft sie stattdessen Apex auf,
mit demselben JSON, in denselben Teilen:

```apex
String answer = mzw.SfibaImport.accept(json);
```

Die Antwort ist das JSON der bisherigen Antwort (`salesforce/INTERFACE.md` in
IBA-Salesforce, Abschnitt 1):

```json
{"transmissionId":"001...-2026-11-17T09:00:00Z","part":1,"accountId":"0017Q00000KpLmNQAV",
 "rowsAccepted":12,"tagsWithoutAsset":0,"unknownValues":{"FSLEH_Criticality__c":["Very high"]},
 "alreadySeen":false,"complete":false,"openUrl":null}
```

`openUrl` ist immer `null`: der Berater oeffnet die Daten mit der Schaltflaeche "SF IBA Report" am Account.

## Regeln

Unveraendert gegenueber der Tomcat-Fassung:

- Eine Lieferung ergaenzt oder ersetzt Zeilen, sie loescht nie welche.
- Stammdaten werden ueberschrieben, Beratereingaben nie.
- Derselbe Teil mit demselben Inhalt wird erkannt (`alreadySeen`) und nicht noch einmal
  verarbeitet. Leerzeichen und Zeilenumbrueche zaehlen nicht als Inhalt.
- Ein unbekannter Auswahlwert weist die Lieferung nicht ab: er wird als nicht gesetzt
  gespeichert und unter `unknownValues` genannt. Der Parametertyp wird wie gesendet
  gespeichert.
- Messstellen ohne Geraet werden gezaehlt (`tagsWithoutAsset`) und nicht uebernommen.

## Fehler

Daten, die nicht zum Schema passen, loesen `mzw.SfibaImport.ImportException` aus. Die
Meldung nennt alle Fundstellen auf einmal, im Wortlaut der bisherigen Antwort 400, etwa:

```
Die gesendeten Daten entsprechen nicht dem vereinbarten Schema: /account/Id: does not
match the pattern ^[a-zA-Z0-9]{15,18}$; /transmission/part: must have a minimum value of 1
```

Es wird dann nichts gespeichert. Ein Teil, dessen Speichern scheitert, gilt nicht als
gesehen und kann wiederholt werden.

Neu gegenueber der Tomcat-Fassung: `part` groesser als `partCount` wird als Schemafehler
gemeldet; bisher endete das in einem Fehler 500.

## Groesse der Teile

Ein Aufruf ist eine Apex-Transaktion. Es gelten deren Grenzen (aus `realreports/docs/SALESFORCE.md`,
dort nach der Doku von Salesforce geprueft): Heap 6 MB synchron, 12 MB asynchron.
Hinzu kommen hoechstens 10.000 geschriebene Datensaetze je Transaktion (nicht nachgesehen).

Die Testdaten haben rund 1,3 KB JSON je Zeile. Mit dem, was Apex beim Lesen daraus macht,
ist das eine Schaetzung, keine Messung:

| Aufruf | Zeilen je Teil |
|---|---|
| synchron, etwa aus einer Schaltflaeche | bis 1.000 |
| aus einer Queueable oder einem Batch | bis 2.500 |

Die Grenze wird mit der grossen Testanlage in Schritt 2 gemessen und hier nachgetragen.

## Schnittstelle zu E+H

`mzw.SfibaImport` ist `global` und damit Teil des Vertrags. Methode, Antwort und Ausnahme
bleiben, solange es keinen abgestimmten Grund gibt, sie zu aendern.

Was E+H an ihrer Aktion aendert: statt des Callouts an die Named Credential
`SFIBA_Report_Server` den Aufruf oben; der Benutzer, unter dem die Aktion laeuft, bekommt
das Permission Set **SF IBA Data Sender**. Die Named Credential und das Anmeldeverfahren
des Servers entfallen.
