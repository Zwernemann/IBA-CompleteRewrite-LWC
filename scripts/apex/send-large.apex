// Starts a load test plant of 50,000 rows in a test org (DIBA Test Data installed).
// The parts arrive as Queueables, about one per few seconds; follow them in
// mzw__DIBA_Transmission__c or in the tab "DIBA Report".
System.debug(mzw.DibaLargeAccount.start(null, 50000));
