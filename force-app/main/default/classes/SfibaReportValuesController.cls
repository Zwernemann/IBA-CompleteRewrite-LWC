/**
 * Report texts and report settings of an account, one SFIBA_Report_Value__c per field with its
 * value as JSON and a version (ReportValueRepository of IBA-Salesforce). A field is only
 * overwritten if it still has the version the page loaded; otherwise it is reported back
 * as a conflict with the version it now has, or -1 if it no longer exists.
 */
public with sharing class SfibaReportValuesController {
    public static final Set<String> SECTIONS = new Set<String>{ 'texts', 'settings' };

    public class Stored {
        @AuraEnabled
        public String json;
        @AuraEnabled
        public Integer version;
    }

    public class Loaded {
        @AuraEnabled
        public Map<String, Stored> texts = new Map<String, Stored>();
        @AuraEnabled
        public Map<String, Stored> settings = new Map<String, Stored>();
        @AuraEnabled
        public String jobId;
        @AuraEnabled
        public String siteName;
        @AuraEnabled
        public String presetLanguage;
        /** "true", "false" or null, as the delivery suggested it. */
        @AuraEnabled
        public String presetFinalReport;
    }

    public class SaveResult {
        @AuraEnabled
        public Map<String, Integer> versions = new Map<String, Integer>();
        @AuraEnabled
        public Map<String, Integer> conflicts = new Map<String, Integer>();
    }

    @AuraEnabled
    public static Loaded load(Id accountDataId) {
        SFIBA_Account__c accountData = [
            SELECT
                Name,
                SFIBA_Account_Key__c,
                SFIBA_Preset_Language__c,
                SFIBA_Preset_Final_Report__c
            FROM SFIBA_Account__c
            WHERE Id = :accountDataId
        ];
        Loaded result = new Loaded();
        result.jobId = accountData.SFIBA_Account_Key__c;
        result.siteName = accountData.Name;
        result.presetLanguage = accountData.SFIBA_Preset_Language__c;
        result.presetFinalReport = accountData.SFIBA_Preset_Final_Report__c;
        for (SFIBA_Report_Value__c value : [
            SELECT SFIBA_Section__c, SFIBA_Value_Name__c, SFIBA_Value__c, SFIBA_Version__c
            FROM SFIBA_Report_Value__c
            WHERE SFIBA_Account__c = :accountDataId
        ]) {
            Stored stored = new Stored();
            stored.json = value.SFIBA_Value__c;
            stored.version = value.SFIBA_Version__c == null ? 0 : value.SFIBA_Version__c.intValue();
            (value.SFIBA_Section__c == 'texts' ? result.texts : result.settings)
                .put(value.SFIBA_Value_Name__c, stored);
        }
        return result;
    }

    /**
     * @param valuesJson   {"name": "<JSON text of the value>", ...}
     * @param versionsJson {"name": version, ...} as loaded; a field without a version is new
     */
    @AuraEnabled
    public static SaveResult save(
        Id accountDataId,
        String section,
        String valuesJson,
        String versionsJson
    ) {
        if (!SECTIONS.contains(section)) {
            throw new AuraHandledException('Unknown section ' + section);
        }
        Map<String, Object> values = (Map<String, Object>) JSON.deserializeUntyped(valuesJson);
        Map<String, Object> expected = String.isBlank(versionsJson)
            ? new Map<String, Object>()
            : (Map<String, Object>) JSON.deserializeUntyped(versionsJson);
        SFIBA_Account__c accountData = [
            SELECT SFIBA_Account_Key__c
            FROM SFIBA_Account__c
            WHERE Id = :accountDataId
        ];

        Map<String, String> keys = new Map<String, String>();
        for (String name : values.keySet()) {
            keys.put(name, accountData.SFIBA_Account_Key__c + '/' + section + '/' + name);
        }
        Map<String, SFIBA_Report_Value__c> current = new Map<String, SFIBA_Report_Value__c>();
        for (SFIBA_Report_Value__c value : [
            SELECT Id, SFIBA_Value_Key__c, SFIBA_Value_Name__c, SFIBA_Version__c
            FROM SFIBA_Report_Value__c
            WHERE SFIBA_Value_Key__c IN :keys.values()
            FOR UPDATE
        ]) {
            current.put(value.SFIBA_Value_Name__c, value);
        }

        SaveResult result = new SaveResult();
        List<SFIBA_Report_Value__c> writes = new List<SFIBA_Report_Value__c>();
        for (String name : values.keySet()) {
            SFIBA_Report_Value__c existing = current.get(name);
            Integer stored = existing == null ||
                existing.SFIBA_Version__c == null
                ? null
                : existing.SFIBA_Version__c.intValue();
            Object value = values.get(name);
            String json = value == null ? null : String.valueOf(value);
            if (expected.containsKey(name)) {
                Integer wanted = Integer.valueOf(expected.get(name));
                if (existing == null || stored != wanted) {
                    result.conflicts.put(name, existing == null ? -1 : stored);
                    continue;
                }
                existing.SFIBA_Value__c = json;
                existing.SFIBA_Version__c = stored + 1;
                writes.add(existing);
                result.versions.put(name, stored + 1);
            } else {
                if (existing != null) {
                    result.conflicts.put(name, stored);
                    continue;
                }
                writes.add(
                    new SFIBA_Report_Value__c(
                        SFIBA_Account__c = accountDataId,
                        SFIBA_Value_Key__c = keys.get(name),
                        SFIBA_Section__c = section,
                        SFIBA_Value_Name__c = name,
                        SFIBA_Value__c = json,
                        SFIBA_Version__c = 0
                    )
                );
                result.versions.put(name, 0);
            }
        }
        upsert writes;
        return result;
    }
}
