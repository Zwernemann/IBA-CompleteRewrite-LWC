/**
 * Delivers the test account to the package the way E+H's action does: two parts in schema v3
 * through mzw.SfibaImport.accept. Only for test orgs; never installed at E+H.
 *
 * Anonymous Apex in a test org (scripts/apex/send-testdata.apex):
 *
 *   System.debug(mzw.SfibaTestData.send(null));        the fixed test account
 *   System.debug(mzw.SfibaTestData.send('001...'));    under an account of the org
 */
global with sharing class SfibaTestData {
    private static final List<String> PARTS = new List<String>{
        'SfibaTestdataPart1',
        'SfibaTestdataPart2'
    };

    /**
     * Sends both parts and returns the answers, one per line.
     *
     * @param accountId account to deliver under, or null for the account of the files
     */
    global static String send(Id accountId) {
        List<String> answers = new List<String>();
        String transmissionId = 'TESTDATEN-' + System.now().getTime();
        for (String part : PARTS) {
            answers.add(SfibaImport.accept(prepare(part, accountId, transmissionId)));
        }
        return String.join(answers, '\n');
    }

    /** One part with a fresh transmission id, so a second run is not taken as a repetition. */
    @TestVisible
    private static String prepare(String resourceName, Id accountId, String transmissionId) {
        StaticResource resource = [
            SELECT Body
            FROM StaticResource
            WHERE Name = :resourceName
            LIMIT 1
        ];
        Map<String, Object> data = (Map<String, Object>) System.JSON.deserializeUntyped(
            resource.Body.toString()
        );
        ((Map<String, Object>) data.get('transmission')).put('id', transmissionId);
        if (accountId != null) {
            Account account = [SELECT Name FROM Account WHERE Id = :accountId];
            Map<String, Object> target = (Map<String, Object>) data.get('account');
            target.put('Id', (String) account.Id);
            target.put('Name', account.Name);
        }
        return System.JSON.serialize(data);
    }
}
