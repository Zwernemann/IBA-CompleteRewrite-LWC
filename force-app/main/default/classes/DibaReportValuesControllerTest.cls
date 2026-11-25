@IsTest
private class DibaReportValuesControllerTest {
    @TestSetup
    static void plant() {
        insert new DIBA_Account__c(
            Name = 'DIBA Testanlage Nord',
            Account_Key__c = '0017Q00000TsTdAQAV',
            Preset_Language__c = 'de_DE',
            Preset_Final_Report__c = 'true'
        );
    }

    private static Id plantId() {
        return [SELECT Id FROM DIBA_Account__c].Id;
    }

    @IsTest
    static void storesNewFieldsAndLoadsThem() {
        DibaReportValuesController.SaveResult result = DibaReportValuesController.save(
            plantId(),
            'texts',
            '{"overview_situation": "\\"<b>x</b>\\"", "sliderMaintenance": "70"}',
            '{}'
        );
        Assert.areEqual(0, result.versions.get('overview_situation'));
        Assert.isTrue(result.conflicts.isEmpty());

        DibaReportValuesController.Loaded loaded = DibaReportValuesController.load(plantId());
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
        DibaReportValuesController.save(plantId(), 'settings', '{"userName": "\\"A\\""}', '{}');
        DibaReportValuesController.SaveResult second = DibaReportValuesController.save(
            plantId(),
            'settings',
            '{"userName": "\\"B\\""}',
            '{"userName": 0}'
        );
        Assert.areEqual(1, second.versions.get('userName'));

        // A page that still has version 0 does not overwrite B.
        DibaReportValuesController.SaveResult stale = DibaReportValuesController.save(
            plantId(),
            'settings',
            '{"userName": "\\"C\\""}',
            '{"userName": 0}'
        );
        Assert.areEqual(1, stale.conflicts.get('userName'));
        Assert.areEqual(
            '"B"',
            DibaReportValuesController.load(plantId()).settings.get('userName').json
        );

        // Two pages that both think the field is new: the second gets a conflict.
        DibaReportValuesController.SaveResult twice = DibaReportValuesController.save(
            plantId(),
            'settings',
            '{"userName": "\\"D\\""}',
            '{}'
        );
        Assert.areEqual(1, twice.conflicts.get('userName'));
    }

    @IsTest
    static void missingFieldIsAConflictWithMinusOne() {
        DibaReportValuesController.SaveResult result = DibaReportValuesController.save(
            plantId(),
            'texts',
            '{"overview_reason": "\\"x\\""}',
            '{"overview_reason": 4}'
        );
        Assert.areEqual(-1, result.conflicts.get('overview_reason'));
    }

    @IsTest
    static void rejectsAnUnknownSection() {
        try {
            DibaReportValuesController.save(plantId(), 'other', '{}', '{}');
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
    }
}
