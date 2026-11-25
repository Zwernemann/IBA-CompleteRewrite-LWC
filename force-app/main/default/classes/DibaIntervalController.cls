/**
 * The interval table of a plant: the defaults of E+H (custom metadata DIBA_Interval__mdt)
 * with the cells changed for the plant on top (DIBA_Interval_Value__c), as
 * IntervalTableSession of IBA-Salesforce. A cell set back to its default is removed.
 */
public with sharing class DibaIntervalController {
    public static final List<String> COLUMNS = new List<String>{
        'high_normal_insp',
        'high_heavy_insp',
        'medium_normal_insp',
        'medium_heavy_insp',
        'low_normal_insp',
        'low_heavy_insp',
        'high_normal_calib',
        'high_heavy_calib',
        'medium_normal_calib',
        'medium_heavy_calib',
        'low_normal_calib',
        'low_heavy_calib',
        'high_normal_valid',
        'high_heavy_valid',
        'medium_normal_valid',
        'medium_heavy_valid',
        'low_normal_valid',
        'low_heavy_valid'
    };
    public static final Integer MAX_LENGTH = 32;

    public class Table {
        /** The rows as in the report XML: id, spk, assettype and the 18 columns. */
        @AuraEnabled
        public List<Map<String, Object>> rows = new List<Map<String, Object>>();
        /** The defaults per SPK and column. */
        @AuraEnabled
        public Map<String, Map<String, String>> defaults = new Map<String, Map<String, String>>();
        /** The version of every changed cell per SPK and column. */
        @AuraEnabled
        public Map<String, Map<String, Integer>> versions = new Map<String, Map<String, Integer>>();
    }

    public class Cell {
        @AuraEnabled
        public Boolean exists;
        @AuraEnabled
        public String value;
        @AuraEnabled
        public Integer version;
    }

    public class SaveResult {
        /** New version per column; -1 where the change was removed (back to default). */
        @AuraEnabled
        public Map<String, Integer> versions = new Map<String, Integer>();
        /** Cells someone else changed in the meantime, with what is stored now. */
        @AuraEnabled
        public Map<String, Cell> conflicts = new Map<String, Cell>();
    }

    /** The column name of a metadata field such as High_Normal_Insp__c. */
    private static String fieldOf(String column) {
        List<String> parts = new List<String>();
        for (String part : column.split('_')) {
            parts.add(part.capitalize());
        }
        return String.join(parts, '_') + '__c';
    }

    @AuraEnabled
    public static Table getIntervals(Id plantId) {
        List<DIBA_Interval__mdt> defaults = DIBA_Interval__mdt.getAll().values();
        Map<String, DIBA_Interval__mdt> bySort = new Map<String, DIBA_Interval__mdt>();
        for (DIBA_Interval__mdt record : defaults) {
            bySort.put(record.Sort_Order__c, record);
        }
        List<String> order = new List<String>(bySort.keySet());
        order.sort();

        Map<String, Map<String, DIBA_Interval_Value__c>> changes = new Map<String, Map<String, DIBA_Interval_Value__c>>();
        if (plantId != null) {
            for (DIBA_Interval_Value__c value : [
                SELECT Spk__c, Field__c, Value__c, Version__c
                FROM DIBA_Interval_Value__c
                WHERE DIBA_Account__c = :plantId
            ]) {
                if (!changes.containsKey(value.Spk__c)) {
                    changes.put(value.Spk__c, new Map<String, DIBA_Interval_Value__c>());
                }
                changes.get(value.Spk__c).put(value.Field__c, value);
            }
        }

        Table table = new Table();
        for (String position : order) {
            DIBA_Interval__mdt record = bySort.get(position);
            Map<String, Object> row = new Map<String, Object>{
                'id' => Integer.valueOf(record.Sort_Order__c),
                'spk' => record.Spk__c,
                'assettype' => record.Asset_Type__c == null ? '' : record.Asset_Type__c
            };
            Map<String, String> rowDefaults = new Map<String, String>();
            Map<String, Integer> rowVersions = new Map<String, Integer>();
            Map<String, DIBA_Interval_Value__c> changed = changes.containsKey(record.Spk__c)
                ? changes.get(record.Spk__c)
                : new Map<String, DIBA_Interval_Value__c>();
            for (String column : COLUMNS) {
                String value = (String) record.get(fieldOf(column));
                rowDefaults.put(column, value == null ? '' : value);
                DIBA_Interval_Value__c change = changed.get(column);
                if (change != null) {
                    row.put(column, change.Value__c);
                    rowVersions.put(
                        column,
                        change.Version__c == null ? 0 : change.Version__c.intValue()
                    );
                } else {
                    row.put(column, value == null ? '' : value);
                }
            }
            table.rows.add(row);
            table.defaults.put(record.Spk__c, rowDefaults);
            table.versions.put(record.Spk__c, rowVersions);
        }
        return table;
    }

    /**
     * Saves changed cells of one SPK.
     *
     * @param valuesJson   {"column": "value" or null}; null removes the change (default again)
     * @param versionsJson {"column": version} of the cells changed so far, as loaded
     */
    @AuraEnabled
    public static SaveResult saveCells(
        Id plantId,
        String spk,
        String valuesJson,
        String versionsJson
    ) {
        Map<String, Object> values = (Map<String, Object>) JSON.deserializeUntyped(valuesJson);
        Map<String, Object> expected = String.isBlank(versionsJson)
            ? new Map<String, Object>()
            : (Map<String, Object>) JSON.deserializeUntyped(versionsJson);
        Set<String> columns = new Set<String>(COLUMNS);
        DIBA_Account__c plant = [SELECT Account_Key__c FROM DIBA_Account__c WHERE Id = :plantId];
        Map<String, String> keys = new Map<String, String>();
        for (String column : values.keySet()) {
            if (!columns.contains(column)) {
                throw new AuraHandledException('Unknown column ' + column);
            }
            Object value = values.get(column);
            if (value != null && String.valueOf(value).length() > MAX_LENGTH) {
                throw new AuraHandledException(
                    'An interval can have at most ' +
                        MAX_LENGTH +
                        ' characters; the value was not saved.'
                );
            }
            keys.put(column, plant.Account_Key__c + '/' + spk + '/' + column);
        }
        Map<String, DIBA_Interval_Value__c> current = new Map<String, DIBA_Interval_Value__c>();
        for (DIBA_Interval_Value__c value : [
            SELECT Id, Field__c, Value__c, Version__c
            FROM DIBA_Interval_Value__c
            WHERE Value_Key__c IN :keys.values()
            FOR UPDATE
        ]) {
            current.put(value.Field__c, value);
        }

        SaveResult result = new SaveResult();
        List<DIBA_Interval_Value__c> writes = new List<DIBA_Interval_Value__c>();
        List<DIBA_Interval_Value__c> removals = new List<DIBA_Interval_Value__c>();
        for (String column : values.keySet()) {
            DIBA_Interval_Value__c existing = current.get(column);
            Integer stored = existing == null ||
                existing.Version__c == null
                ? 0
                : existing.Version__c.intValue();
            Boolean matches = expected.containsKey(column)
                ? existing != null && stored == Integer.valueOf(expected.get(column))
                : existing == null;
            if (!matches) {
                Cell cell = new Cell();
                cell.exists = existing != null;
                cell.value = existing == null ? null : existing.Value__c;
                cell.version = existing == null ? null : stored;
                result.conflicts.put(column, cell);
                continue;
            }
            Object value = values.get(column);
            if (value == null) {
                if (existing != null) {
                    removals.add(existing);
                }
                result.versions.put(column, -1);
            } else if (existing != null) {
                existing.Value__c = String.valueOf(value);
                existing.Version__c = stored + 1;
                writes.add(existing);
                result.versions.put(column, stored + 1);
            } else {
                writes.add(
                    new DIBA_Interval_Value__c(
                        DIBA_Account__c = plantId,
                        Value_Key__c = keys.get(column),
                        Spk__c = spk,
                        Field__c = column,
                        Value__c = String.valueOf(value),
                        Version__c = 0
                    )
                );
                result.versions.put(column, 0);
            }
        }
        upsert writes;
        delete removals;
        return result;
    }
}
