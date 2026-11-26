// Delivers the test plant data to the installed package under the account
// "DIBA Testanlage Nord" of the org (created if missing) and checks the answer.
// Run by scripts/org-install-test.sh; prints DIBA-TEST-OK when everything is as expected.
List<Account> accounts = [SELECT Id FROM Account WHERE Name = 'DIBA Testanlage Nord' LIMIT 1];
Account account = accounts.isEmpty() ? new Account(Name = 'DIBA Testanlage Nord') : accounts[0];
if (account.Id == null) {
    insert account;
}
String answers = mzw.SfibaTestData.send(account.Id);
System.debug(answers);
List<String> lines = answers.split('\n');
Map<String, Object> last = (Map<String, Object>) JSON.deserializeUntyped(lines[lines.size() - 1]);
Integer rows = [SELECT COUNT() FROM mzw__SFIBA_Row__c WHERE mzw__SFIBA_Account__r.mzw__SFIBA_Account__c = :account.Id];
if (last.get('complete') == true && rows == 21) {
    System.debug('DIBA-TEST-OK');
} else {
    System.debug('DIBA-TEST-FAILED complete=' + last.get('complete') + ' rows=' + rows);
}
