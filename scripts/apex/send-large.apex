// Starts a load test plant of 50,000 rows in a test org (SF Frontend IBA Test Data installed).
// The parts arrive as Queueables, about one per few seconds; follow them in
// mzw__SFIBA_Transmission__c or in the tab "SF IBA Report".
System.debug(mzw.SfibaLargeAccount.start(null, 50000));
