/**
 * Report texts and report settings of a plant, one DIBA_Report_Value__c per field with its
 * value as JSON and a version (ReportValueRepository of IBA-Salesforce). A field is only
 * overwritten if it still has the version the page loaded; otherwise it is reported back
 * as a conflict with the version it now has, or -1 if it no longer exists.
 */
public with sharing class DibaReportValuesController {
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
    public static Loaded load(Id plantId) {
        DIBA_Account__c plant = [
            SELECT Name, Account_Key__c, Preset_Language__c, Preset_Final_Report__c
            FROM DIBA_Account__c
            WHERE Id = :plantId
        ];
        Loaded result = new Loaded();
        result.jobId = plant.Account_Key__c;
        result.siteName = plant.Name;
        result.presetLanguage = plant.Preset_Language__c;
        result.presetFinalReport = plant.Preset_Final_Report__c;
        for (DIBA_Report_Value__c value : [
            SELECT Section__c, Value_Name__c, Value__c, Version__c
            FROM DIBA_Report_Value__c
            WHERE DIBA_Account__c = :plantId
        ]) {
            Stored stored = new Stored();
            stored.json = value.Value__c;
            stored.version = value.Version__c == null ? 0 : value.Version__c.intValue();
            (value.Section__c == 'texts' ? result.texts : result.settings)
                .put(value.Value_Name__c, stored);
        }
        return result;
    }

    /**
     * @param valuesJson   {"name": "<JSON text of the value>", ...}
     * @param versionsJson {"name": version, ...} as loaded; a field without a version is new
     */
    @AuraEnabled
    public static SaveResult save(
        Id plantId,
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
        DIBA_Account__c plant = [SELECT Account_Key__c FROM DIBA_Account__c WHERE Id = :plantId];

        Map<String, String> keys = new Map<String, String>();
        for (String name : values.keySet()) {
            keys.put(name, plant.Account_Key__c + '/' + section + '/' + name);
        }
        Map<String, DIBA_Report_Value__c> current = new Map<String, DIBA_Report_Value__c>();
        for (DIBA_Report_Value__c value : [
            SELECT Id, Value_Key__c, Value_Name__c, Version__c
            FROM DIBA_Report_Value__c
            WHERE Value_Key__c IN :keys.values()
            FOR UPDATE
        ]) {
            current.put(value.Value_Name__c, value);
        }

        SaveResult result = new SaveResult();
        List<DIBA_Report_Value__c> writes = new List<DIBA_Report_Value__c>();
        for (String name : values.keySet()) {
            DIBA_Report_Value__c existing = current.get(name);
            Integer stored = existing == null ||
                existing.Version__c == null
                ? null
                : existing.Version__c.intValue();
            Object value = values.get(name);
            String json = value == null ? null : String.valueOf(value);
            if (expected.containsKey(name)) {
                Integer wanted = Integer.valueOf(expected.get(name));
                if (existing == null || stored != wanted) {
                    result.conflicts.put(name, existing == null ? -1 : stored);
                    continue;
                }
                existing.Value__c = json;
                existing.Version__c = stored + 1;
                writes.add(existing);
                result.versions.put(name, stored + 1);
            } else {
                if (existing != null) {
                    result.conflicts.put(name, stored);
                    continue;
                }
                writes.add(
                    new DIBA_Report_Value__c(
                        DIBA_Account__c = plantId,
                        Value_Key__c = keys.get(name),
                        Section__c = section,
                        Value_Name__c = name,
                        Value__c = json,
                        Version__c = 0
                    )
                );
                result.versions.put(name, 0);
            }
        }
        upsert writes;
        return result;
    }
}
