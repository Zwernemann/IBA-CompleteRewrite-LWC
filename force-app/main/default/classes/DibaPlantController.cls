/**
 * Server side of the user interface (tab "DIBA Report"): the plants, their rows page by
 * page, and saving what the consultant changed.
 *
 * Saving checks the version of every row: a row someone else saved in the meantime is not
 * overwritten, it comes back as a conflict with its current content (optimistic locking,
 * as ADR 0008 of IBA-Salesforce).
 */
public with sharing class DibaPlantController {
    /** Rows per call at most; the client asks page after page. */
    public static final Integer MAX_PAGE = 2000;

    public class Plant {
        @AuraEnabled
        public Id recordId;
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String accountKey;
        @AuraEnabled
        public Id accountId;
        @AuraEnabled
        public Integer rowCount;
        @AuraEnabled
        public Datetime lastDelivery;
    }

    public class Page {
        @AuraEnabled
        public List<Map<String, Object>> rows = new List<Map<String, Object>>();
        /** Row key of the last row, to ask for the next page; null after the last page. */
        @AuraEnabled
        public String nextAfter;
    }

    public class SaveResult {
        /** Saved rows with their new version: id to version. */
        @AuraEnabled
        public Map<Id, Integer> saved = new Map<Id, Integer>();
        /** Rows someone else saved in the meantime, in their current state. */
        @AuraEnabled
        public List<Map<String, Object>> conflicts = new List<Map<String, Object>>();
        /** Rows not saved because of a bad value: id to message. */
        @AuraEnabled
        public Map<Id, String> errors = new Map<Id, String>();
    }

    /** All plants, newest delivery first. */
    @AuraEnabled(cacheable=false)
    public static List<Plant> listPlants() {
        Map<Id, Datetime> lastDelivery = new Map<Id, Datetime>();
        for (AggregateResult result : [
            SELECT DIBA_Account__c plant, MAX(Received_At__c) received
            FROM DIBA_Transmission__c
            GROUP BY DIBA_Account__c
        ]) {
            lastDelivery.put((Id) result.get('plant'), (Datetime) result.get('received'));
        }
        Map<Id, Integer> rowCounts = new Map<Id, Integer>();
        for (AggregateResult result : [
            SELECT DIBA_Account__c plant, COUNT(Id) rows
            FROM DIBA_Row__c
            GROUP BY DIBA_Account__c
        ]) {
            rowCounts.put((Id) result.get('plant'), (Integer) result.get('rows'));
        }
        List<Plant> plants = new List<Plant>();
        for (DIBA_Account__c record : [
            SELECT Id, Name, Account_Key__c, Account__c
            FROM DIBA_Account__c
            ORDER BY Name
            LIMIT 2000
        ]) {
            Plant plant = new Plant();
            plant.recordId = record.Id;
            plant.name = record.Name;
            plant.accountKey = record.Account_Key__c;
            plant.accountId = record.Account__c;
            plant.rowCount = rowCounts.containsKey(record.Id) ? rowCounts.get(record.Id) : 0;
            plant.lastDelivery = lastDelivery.get(record.Id);
            plants.add(plant);
        }
        return plants;
    }

    /** One page of rows of a plant, in the order of their key. */
    @AuraEnabled(cacheable=false)
    public static Page getRows(Id plantId, String afterKey, Integer pageSize) {
        Integer size = pageSize == null ||
            pageSize < 1 ||
            pageSize > MAX_PAGE
            ? MAX_PAGE
            : pageSize;
        String after = afterKey == null ? '' : afterKey;
        List<DIBA_Row__c> records = Database.query(
            'SELECT ' +
                DibaRowFields.selectList() +
                ' FROM DIBA_Row__c WHERE DIBA_Account__c = :plantId AND Row_Key__c > :after' +
                ' ORDER BY Row_Key__c LIMIT :size'
        );
        Page page = new Page();
        for (DIBA_Row__c record : records) {
            page.rows.add(DibaRowFields.toMap(record));
        }
        if (records.size() == size) {
            page.nextAfter = records[records.size() - 1].Row_Key__c;
        }
        return page;
    }

    /**
     * Saves changes of rows. The JSON is a list of
     * {"id": ..., "version": n, "values": {"add_remark1": "...", ...},
     *  "edits": [{"field": "device_ordercode", "value": "...", "salesforceValue": "..."}]}.
     * values may hold consultant and calculated fields; master fields change only through
     * edits. An edit with value null is removed.
     */
    @AuraEnabled
    public static SaveResult saveRows(String changesJson) {
        List<Object> changes = (List<Object>) JSON.deserializeUntyped(changesJson);
        Map<Id, Map<String, Object>> byId = new Map<Id, Map<String, Object>>();
        for (Object change : changes) {
            Map<String, Object> entry = (Map<String, Object>) change;
            byId.put(Id.valueOf((String) entry.get('id')), entry);
        }
        SaveResult result = new SaveResult();
        if (byId.isEmpty()) {
            return result;
        }
        Set<Id> ids = byId.keySet();
        Map<Id, DIBA_Row__c> current = new Map<Id, DIBA_Row__c>(
            [SELECT Id, Version__c, Row_Key__c FROM DIBA_Row__c WHERE Id IN :ids FOR UPDATE]
        );
        Set<Id> conflicting = new Set<Id>();

        List<DIBA_Row__c> updates = new List<DIBA_Row__c>();
        List<DIBA_Master_Edit__c> upserts = new List<DIBA_Master_Edit__c>();
        Set<String> removals = new Set<String>();
        Datetime now = System.now();
        for (Id rowId : byId.keySet()) {
            DIBA_Row__c row = current.get(rowId);
            if (row == null) {
                result.errors.put(rowId, 'The row no longer exists.');
                continue;
            }
            Map<String, Object> change = byId.get(rowId);
            Integer stored = row.Version__c == null ? 0 : row.Version__c.intValue();
            Integer expected = change.get('version') == null
                ? 0
                : Integer.valueOf(change.get('version'));
            if (stored != expected) {
                conflicting.add(rowId);
                continue;
            }
            try {
                DIBA_Row__c changed = new DIBA_Row__c(Id = rowId);
                Map<String, Object> values = (Map<String, Object>) change.get('values');
                if (values != null) {
                    for (String name : values.keySet()) {
                        DibaRowFields.Field field = DibaRowFields.get(name);
                        if (
                            field == null ||
                            (field.kind != DibaRowFields.Kind.CONSULTANT &&
                            field.kind != DibaRowFields.Kind.CALCULATED)
                        ) {
                            throw new IllegalArgumentException(name + ' cannot be changed here.');
                        }
                        changed.put(field.token, DibaRowFields.fromClient(field, values.get(name)));
                    }
                }
                List<Object> edits = (List<Object>) change.get('edits');
                if (edits != null) {
                    for (Object editObject : edits) {
                        Map<String, Object> edit = (Map<String, Object>) editObject;
                        String name = (String) edit.get('field');
                        if (!DibaRowFields.EDITABLE_MASTER.contains(name)) {
                            throw new IllegalArgumentException(name + ' cannot be changed here.');
                        }
                        String key = row.Row_Key__c + '/' + name;
                        Object value = edit.get('value');
                        if (value == null) {
                            removals.add(key);
                        } else {
                            upserts.add(
                                new DIBA_Master_Edit__c(
                                    Edit_Key__c = key,
                                    DIBA_Row__c = rowId,
                                    Field__c = name,
                                    Value__c = String.valueOf(value),
                                    Salesforce_Value__c = edit.get('salesforceValue') == null
                                        ? null
                                        : String.valueOf(edit.get('salesforceValue'))
                                )
                            );
                        }
                    }
                }
                changed.Version__c = stored + 1;
                changed.Consultant_Updated_At__c = now;
                updates.add(changed);
                result.saved.put(rowId, stored + 1);
            } catch (Exception e) {
                result.errors.put(rowId, e.getMessage());
            }
        }
        if (!conflicting.isEmpty()) {
            for (
                DIBA_Row__c row : (List<DIBA_Row__c>) Database.query(
                    'SELECT ' +
                        DibaRowFields.selectList() +
                        ' FROM DIBA_Row__c WHERE Id IN :conflicting'
                )
            ) {
                result.conflicts.add(DibaRowFields.toMap(row));
            }
        }
        update updates;
        if (!upserts.isEmpty()) {
            upsert upserts DIBA_Master_Edit__c.Fields.Edit_Key__c;
        }
        if (!removals.isEmpty()) {
            delete [SELECT Id FROM DIBA_Master_Edit__c WHERE Edit_Key__c IN :removals];
        }
        return result;
    }

    /**
     * Looks up the successor of the order code of one row at once, as the table does when
     * the order code was changed, and stores it.
     *
     * @return the row as it is now stored
     */
    @AuraEnabled
    public static Map<String, Object> lookupOrderCode(Id rowId) {
        DIBA_Row__c row = (DIBA_Row__c) Database.query(
            'SELECT ' + DibaRowFields.selectList() + ' FROM DIBA_Row__c WHERE Id = :rowId'
        )[0];
        String code = DibaOrderCodes.effectiveCode(row);
        Map<String, String> results;
        try {
            results = DibaOrderCodes.lookup(new Set<String>{ code });
        } catch (DibaOrderCodes.TransformerException e) {
            throw new AuraHandledException(e.getMessage());
        }
        DIBA_Row__c changed = new DIBA_Row__c(Id = row.Id, Order_Code_Pending__c = false);
        if (DibaOrderCodes.apply(results.get(code), row)) {
            changed.Add_Ordercode_Transform__c = row.Add_Ordercode_Transform__c;
            changed.Add_Recomend_Ordercode__c = row.Add_Recomend_Ordercode__c;
            changed.Version__c = (row.Version__c == null ? 0 : row.Version__c) + 1;
        }
        update changed;
        return DibaRowFields.toMap(
            (DIBA_Row__c) Database.query(
                'SELECT ' + DibaRowFields.selectList() + ' FROM DIBA_Row__c WHERE Id = :rowId'
            )[0]
        );
    }
}
