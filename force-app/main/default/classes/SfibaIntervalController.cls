/**
 * The interval table of an account: the defaults of E+H (custom metadata SFIBA_Interval__mdt)
 * with the cells changed for the account on top (SFIBA_Interval_Value__c), as
 * IntervalTableSession of IBA-Salesforce. A cell set back to its default is removed.
 */
public with sharing class SfibaIntervalController {
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

    /** The column name of a metadata field such as SFIBA_High_Normal_Insp__c. */
    private static String fieldOf(String column) {
        List<String> parts = new List<String>();
        for (String part : column.split('_')) {
            parts.add(part.capitalize());
        }
        return 'SFIBA_' + String.join(parts, '_') + '__c';
    }

    @AuraEnabled
    public static Table getIntervals(Id accountDataId) {
        List<SFIBA_Interval__mdt> defaults = SFIBA_Interval__mdt.getAll().values();
        Map<String, SFIBA_Interval__mdt> bySort = new Map<String, SFIBA_Interval__mdt>();
        for (SFIBA_Interval__mdt record : defaults) {
            bySort.put(record.SFIBA_Sort_Order__c, record);
        }
        List<String> order = new List<String>(bySort.keySet());
        order.sort();

        Map<String, Map<String, SFIBA_Interval_Value__c>> changes = new Map<String, Map<String, SFIBA_Interval_Value__c>>();
        if (accountDataId != null) {
            for (SFIBA_Interval_Value__c value : [
                SELECT SFIBA_Spk__c, SFIBA_Field__c, SFIBA_Value__c, SFIBA_Version__c
                FROM SFIBA_Interval_Value__c
                WHERE SFIBA_Account__c = :accountDataId
            ]) {
                if (!changes.containsKey(value.SFIBA_Spk__c)) {
                    changes.put(value.SFIBA_Spk__c, new Map<String, SFIBA_Interval_Value__c>());
                }
                changes.get(value.SFIBA_Spk__c).put(value.SFIBA_Field__c, value);
            }
        }

        Table table = new Table();
        for (String position : order) {
            SFIBA_Interval__mdt record = bySort.get(position);
            Map<String, Object> row = new Map<String, Object>{
                'id' => Integer.valueOf(record.SFIBA_Sort_Order__c),
                'spk' => record.SFIBA_Spk__c,
                'assettype' => record.SFIBA_Asset_Type__c == null ? '' : record.SFIBA_Asset_Type__c
            };
            Map<String, String> rowDefaults = new Map<String, String>();
            Map<String, Integer> rowVersions = new Map<String, Integer>();
            Map<String, SFIBA_Interval_Value__c> changed = changes.containsKey(record.SFIBA_Spk__c)
                ? changes.get(record.SFIBA_Spk__c)
                : new Map<String, SFIBA_Interval_Value__c>();
            for (String column : COLUMNS) {
                String value = (String) record.get(fieldOf(column));
                rowDefaults.put(column, value == null ? '' : value);
                SFIBA_Interval_Value__c change = changed.get(column);
                if (change != null) {
                    row.put(column, change.SFIBA_Value__c);
                    rowVersions.put(
                        column,
                        change.SFIBA_Version__c == null ? 0 : change.SFIBA_Version__c.intValue()
                    );
                } else {
                    row.put(column, value == null ? '' : value);
                }
            }
            table.rows.add(row);
            table.defaults.put(record.SFIBA_Spk__c, rowDefaults);
            table.versions.put(record.SFIBA_Spk__c, rowVersions);
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
        Id accountDataId,
        String spk,
        String valuesJson,
        String versionsJson
    ) {
        Map<String, Object> values = (Map<String, Object>) JSON.deserializeUntyped(valuesJson);
        Map<String, Object> expected = String.isBlank(versionsJson)
            ? new Map<String, Object>()
            : (Map<String, Object>) JSON.deserializeUntyped(versionsJson);
        Set<String> columns = new Set<String>(COLUMNS);
        SFIBA_Account__c accountData = [
            SELECT SFIBA_Account_Key__c
            FROM SFIBA_Account__c
            WHERE Id = :accountDataId
        ];
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
            keys.put(column, accountData.SFIBA_Account_Key__c + '/' + spk + '/' + column);
        }
        Map<String, SFIBA_Interval_Value__c> current = new Map<String, SFIBA_Interval_Value__c>();
        for (SFIBA_Interval_Value__c value : [
            SELECT Id, SFIBA_Field__c, SFIBA_Value__c, SFIBA_Version__c
            FROM SFIBA_Interval_Value__c
            WHERE SFIBA_Value_Key__c IN :keys.values()
            FOR UPDATE
        ]) {
            current.put(value.SFIBA_Field__c, value);
        }

        SaveResult result = new SaveResult();
        List<SFIBA_Interval_Value__c> writes = new List<SFIBA_Interval_Value__c>();
        List<SFIBA_Interval_Value__c> removals = new List<SFIBA_Interval_Value__c>();
        for (String column : values.keySet()) {
            SFIBA_Interval_Value__c existing = current.get(column);
            Integer stored = existing == null ||
                existing.SFIBA_Version__c == null
                ? 0
                : existing.SFIBA_Version__c.intValue();
            Boolean matches = expected.containsKey(column)
                ? existing != null && stored == Integer.valueOf(expected.get(column))
                : existing == null;
            if (!matches) {
                Cell cell = new Cell();
                cell.exists = existing != null;
                cell.value = existing == null ? null : existing.SFIBA_Value__c;
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
                existing.SFIBA_Value__c = String.valueOf(value);
                existing.SFIBA_Version__c = stored + 1;
                writes.add(existing);
                result.versions.put(column, stored + 1);
            } else {
                writes.add(
                    new SFIBA_Interval_Value__c(
                        SFIBA_Account__c = accountDataId,
                        SFIBA_Value_Key__c = keys.get(column),
                        SFIBA_Spk__c = spk,
                        SFIBA_Field__c = column,
                        SFIBA_Value__c = String.valueOf(value),
                        SFIBA_Version__c = 0
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
