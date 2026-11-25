@IsTest
private class SfibaReportValuesControllerTest {
    @TestSetup
    static void accountData() {
        insert new SFIBA_Account__c(
            Name = 'DIBA Testanlage Nord',
            SFIBA_Account_Key__c = '0017Q00000TsTdAQAV',
            SFIBA_Preset_Language__c = 'de_DE',
            SFIBA_Preset_Final_Report__c = 'true'
        );
    }

    private static Id accountDataId() {
        return [SELECT Id FROM SFIBA_Account__c].Id;
    }

    @IsTest
    static void storesNewFieldsAndLoadsThem() {
        SfibaReportValuesController.SaveResult result = SfibaReportValuesController.save(
            accountDataId(),
            'texts',
            '{"overview_situation": "\\"<b>x</b>\\"", "sliderMaintenance": "70"}',
            '{}'
        );
        Assert.areEqual(0, result.versions.get('overview_situation'));
        Assert.isTrue(result.conflicts.isEmpty());

        SfibaReportValuesController.Loaded loaded = SfibaReportValuesController.load(
            accountDataId()
        );
        Assert.areEqual('"<b>x</b>"', loaded.texts.get('overview_situation').json);
        Assert.areEqual('70', loaded.texts.get('sliderMaintenance').json);
        Assert.areEqual(0, loaded.texts.get('sliderMaintenance').version);
        Assert.isTrue(loaded.settings.isEmpty());
        Assert.areEqual('0017Q00000TsTdAQAV', loaded.jobId);
        Assert.areEqual('de_DE', loaded.presetLanguage);
        Assert.areEqual('true', loaded.presetFinalReport);
    }

    @IsTest
    static void updatesWithTheLoadedVersionOnly() {
        SfibaReportValuesController.save(
            accountDataId(),
            'settings',
            '{"userName": "\\"A\\""}',
            '{}'
        );
        SfibaReportValuesController.SaveResult second = SfibaReportValuesController.save(
            accountDataId(),
            'settings',
            '{"userName": "\\"B\\""}',
            '{"userName": 0}'
        );
        Assert.areEqual(1, second.versions.get('userName'));

        // A page that still has version 0 does not overwrite B.
        SfibaReportValuesController.SaveResult stale = SfibaReportValuesController.save(
            accountDataId(),
            'settings',
            '{"userName": "\\"C\\""}',
            '{"userName": 0}'
        );
        Assert.areEqual(1, stale.conflicts.get('userName'));
        Assert.areEqual(
            '"B"',
            SfibaReportValuesController.load(accountDataId()).settings.get('userName').json
        );

        // Two pages that both think the field is new: the second gets a conflict.
        SfibaReportValuesController.SaveResult twice = SfibaReportValuesController.save(
            accountDataId(),
            'settings',
            '{"userName": "\\"D\\""}',
            '{}'
        );
        Assert.areEqual(1, twice.conflicts.get('userName'));
    }

    @IsTest
    static void missingFieldIsAConflictWithMinusOne() {
        SfibaReportValuesController.SaveResult result = SfibaReportValuesController.save(
            accountDataId(),
            'texts',
            '{"overview_reason": "\\"x\\""}',
            '{"overview_reason": 4}'
        );
        Assert.areEqual(-1, result.conflicts.get('overview_reason'));
    }

    @IsTest
    static void rejectsAnUnknownSection() {
        try {
            SfibaReportValuesController.save(accountDataId(), 'other', '{}', '{}');
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
    }
}
