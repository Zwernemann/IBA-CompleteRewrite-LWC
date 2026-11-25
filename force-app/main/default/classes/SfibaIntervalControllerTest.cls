@IsTest
private class SfibaIntervalControllerTest {
    @TestSetup
    static void accountData() {
        insert new SFIBA_Account__c(Name = 'Nord', SFIBA_Account_Key__c = '0017Q00000TsTdAQAV');
    }

    private static Id accountDataId() {
        return [SELECT Id FROM SFIBA_Account__c].Id;
    }

    private static Map<String, Object> rowOf(SfibaIntervalController.Table table, String spk) {
        for (Map<String, Object> row : table.rows) {
            if (row.get('spk') == spk) {
                return row;
            }
        }
        return null;
    }

    @IsTest
    static void deliversTheDefaultsInTheirOrder() {
        SfibaIntervalController.Table table = SfibaIntervalController.getIntervals(accountDataId());
        Assert.areEqual(90, table.rows.size());
        Assert.areEqual(1, table.rows[0].get('id'));
        Assert.areEqual('CA', table.rows[0].get('spk'));
        Map<String, Object> ta = rowOf(table, 'TA');
        Assert.areEqual('Temperature, Resistor RTD', ta.get('assettype'));
        Assert.areEqual('48', ta.get('low_normal_insp'));
        Assert.isTrue(table.versions.get('TA').isEmpty());
    }

    @IsTest
    static void changesACellAndTakesItBack() {
        SfibaIntervalController.SaveResult saved = SfibaIntervalController.saveCells(
            accountDataId(),
            'TA',
            '{"low_normal_insp": "60"}',
            '{}'
        );
        Assert.areEqual(0, saved.versions.get('low_normal_insp'));
        SfibaIntervalController.Table table = SfibaIntervalController.getIntervals(accountDataId());
        Assert.areEqual('60', rowOf(table, 'TA').get('low_normal_insp'));
        Assert.areEqual('48', table.defaults.get('TA').get('low_normal_insp'));
        Assert.areEqual(0, table.versions.get('TA').get('low_normal_insp'));

        SfibaIntervalController.SaveResult back = SfibaIntervalController.saveCells(
            accountDataId(),
            'TA',
            '{"low_normal_insp": null}',
            '{"low_normal_insp": 0}'
        );
        Assert.areEqual(-1, back.versions.get('low_normal_insp'));
        Assert.areEqual(0, [SELECT COUNT() FROM SFIBA_Interval_Value__c]);
    }

    @IsTest
    static void staleVersionIsAConflict() {
        SfibaIntervalController.saveCells(accountDataId(), 'TA', '{"low_normal_insp": "60"}', '{}');
        SfibaIntervalController.SaveResult stale = SfibaIntervalController.saveCells(
            accountDataId(),
            'TA',
            '{"low_normal_insp": "70"}',
            '{}'
        );
        SfibaIntervalController.Cell cell = stale.conflicts.get('low_normal_insp');
        Assert.isTrue(cell.exists);
        Assert.areEqual('60', cell.value);
        Assert.areEqual(0, cell.version);
    }

    @IsTest
    static void rejectsTooLongValuesAndUnknownColumns() {
        try {
            SfibaIntervalController.saveCells(
                accountDataId(),
                'TA',
                '{"low_normal_insp": "' + 'x'.repeat(33) + '"}',
                '{}'
            );
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
        try {
            SfibaIntervalController.saveCells(accountDataId(), 'TA', '{"other": "1"}', '{}');
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
    }
}
