@IsTest
private class SfibaTestDataTest {
    @IsTest
    static void deliversBothParts() {
        String answers = SfibaTestData.send(null);

        List<String> lines = answers.split('\n');
        Assert.areEqual(2, lines.size());
        Map<String, Object> last = (Map<String, Object>) System.JSON.deserializeUntyped(lines[1]);
        Assert.areEqual(true, last.get('complete'));
        Assert.areEqual(20, [SELECT COUNT() FROM SFIBA_Row__c]);
    }

    @IsTest
    static void deliversUnderAnAccountOfTheOrg() {
        Account account = new Account(Name = 'Chemiewerk Sued GmbH');
        insert account;

        SfibaTestData.send(account.Id);

        SFIBA_Account__c accountData = [SELECT Name, SFIBA_Account__c FROM SFIBA_Account__c];
        Assert.areEqual('Chemiewerk Sued GmbH', accountData.Name);
        Assert.areEqual(account.Id, accountData.SFIBA_Account__c);
    }
}
