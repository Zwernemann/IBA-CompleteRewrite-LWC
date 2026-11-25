// Delivers the test plant to the installed package and checks the answer.
// Run by scripts/org-install-test.sh; prints DIBA-TEST-OK when everything is as expected.
String answers = mzw.DibaTestData.send(null);
System.debug(answers);
List<String> lines = answers.split('\n');
Map<String, Object> last = (Map<String, Object>) JSON.deserializeUntyped(lines[lines.size() - 1]);
Integer rows = [SELECT COUNT() FROM mzw__DIBA_Row__c WHERE mzw__DIBA_Account__r.mzw__Account_Key__c = '0017Q00000TsTdAQAV'];
if (last.get('complete') == true && rows == 20) {
    System.debug('DIBA-TEST-OK');
} else {
    System.debug('DIBA-TEST-FAILED complete=' + last.get('complete') + ' rows=' + rows);
}
