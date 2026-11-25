@IsTest
private class SfibaLargeAccountTest {
    @IsTest
    static void deliversTheFirstPart() {
        Test.startTest();
        String transmissionId = SfibaLargeAccount.start(null, 1500);
        Test.stopTest();

        SFIBA_Transmission__c part = [
            SELECT SFIBA_Part__c, SFIBA_Part_Count__c, SFIBA_Row_Count__c
            FROM SFIBA_Transmission__c
            WHERE SFIBA_Transmission_Id__c = :transmissionId
        ];
        Assert.areEqual(1, part.SFIBA_Part__c);
        Assert.areEqual(2, part.SFIBA_Part_Count__c);
        Assert.areEqual(SfibaLargeAccount.PART_SIZE, [SELECT COUNT() FROM SFIBA_Row__c]);
        Assert.areEqual(
            10,
            [SELECT COUNT() FROM SFIBA_Row__c WHERE SFIBA_Tag_Id__c = NULL],
            'one percent without tag'
        );
    }

    @IsTest
    static void valuesFollowFromTheRowNumber() {
        String first = SfibaLargeAccount.build(
            SfibaLargeAccount.ACCOUNT_ID,
            'DIBA Lasttest',
            2000,
            2,
            'X'
        );
        String second = SfibaLargeAccount.build(
            SfibaLargeAccount.ACCOUNT_ID,
            'DIBA Lasttest',
            2000,
            2,
            'X'
        );
        Assert.areEqual(first, second);
        for (Integer row = 0; row < 500; row++) {
            Integer value = SfibaLargeAccount.pick(row, 3, 120);
            Assert.isTrue(value >= 0 && value < 120);
        }
    }

    @IsTest
    static void partsCoverAllRows() {
        Assert.areEqual(50, SfibaLargeAccount.partCount(50000));
        Assert.areEqual(2, SfibaLargeAccount.partCount(1001));
    }
}
