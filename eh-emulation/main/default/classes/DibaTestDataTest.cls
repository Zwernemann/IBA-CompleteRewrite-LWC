@IsTest
private class DibaTestDataTest {
    @IsTest
    static void deliversBothParts() {
        String answers = DibaTestData.send(null);

        List<String> lines = answers.split('\n');
        Assert.areEqual(2, lines.size());
        Map<String, Object> last = (Map<String, Object>) System.JSON.deserializeUntyped(lines[1]);
        Assert.areEqual(true, last.get('complete'));
        Assert.areEqual(20, [SELECT COUNT() FROM DIBA_Row__c]);
    }

    @IsTest
    static void deliversUnderAnAccountOfTheOrg() {
        Account account = new Account(Name = 'Chemiewerk Sued GmbH');
        insert account;

        DibaTestData.send(account.Id);

        DIBA_Account__c accountData = [SELECT Name, Account__c FROM DIBA_Account__c];
        Assert.areEqual('Chemiewerk Sued GmbH', accountData.Name);
        Assert.areEqual(account.Id, accountData.Account__c);
    }
}
