@IsTest
private class DibaLargePlantTest {
    @IsTest
    static void deliversTheFirstPart() {
        Test.startTest();
        String transmissionId = DibaLargePlant.start(null, 1500);
        Test.stopTest();

        DIBA_Transmission__c part = [
            SELECT Part__c, Part_Count__c, Row_Count__c
            FROM DIBA_Transmission__c
            WHERE Transmission_Id__c = :transmissionId
        ];
        Assert.areEqual(1, part.Part__c);
        Assert.areEqual(2, part.Part_Count__c);
        Assert.areEqual(DibaLargePlant.PART_SIZE, [SELECT COUNT() FROM DIBA_Row__c]);
        Assert.areEqual(
            10,
            [SELECT COUNT() FROM DIBA_Row__c WHERE Tag_Id__c = NULL],
            'one percent without tag'
        );
    }

    @IsTest
    static void valuesFollowFromTheRowNumber() {
        String first = DibaLargePlant.build(
            DibaLargePlant.ACCOUNT_ID,
            'DIBA Lasttest',
            2000,
            2,
            'X'
        );
        String second = DibaLargePlant.build(
            DibaLargePlant.ACCOUNT_ID,
            'DIBA Lasttest',
            2000,
            2,
            'X'
        );
        Assert.areEqual(first, second);
        for (Integer row = 0; row < 500; row++) {
            Integer value = DibaLargePlant.pick(row, 3, 120);
            Assert.isTrue(value >= 0 && value < 120);
        }
    }

    @IsTest
    static void partsCoverAllRows() {
        Assert.areEqual(50, DibaLargePlant.partCount(50000));
        Assert.areEqual(2, DibaLargePlant.partCount(1001));
    }
}
