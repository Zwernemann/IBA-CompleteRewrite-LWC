// Delivers a load test account of 50,000 rows in a test org (SF Frontend IBA Test Data
// installed), under the account "DIBA Lasttest" of the org (created if missing), so that the
// button on the account opens it. The parts arrive as Queueables, about one per few seconds;
// follow them in mzw__SFIBA_Transmission__c or in the tab "SF IBA Report".
// Run by .github/workflows/lastanlage.yml; the rows can be changed there.
Integer rows = 50000;
List<Account> accounts = [SELECT Id FROM Account WHERE Name = 'DIBA Lasttest' LIMIT 1];
Account account = accounts.isEmpty() ? new Account(Name = 'DIBA Lasttest') : accounts[0];
if (account.Id == null) {
    insert account;
}
System.debug('DIBA-LARGE-STARTED ' + mzw.SfibaLargeAccount.start(account.Id, rows));
