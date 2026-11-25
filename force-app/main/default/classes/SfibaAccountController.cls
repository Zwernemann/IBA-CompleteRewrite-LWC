/**
 * Server side of the user interface (button "SF IBA Report" on the account): the DIBA data
 * of the account, its rows page by page, and saving what the consultant changed.
 *
 * Saving checks the version of every row: a row someone else saved in the meantime is not
 * overwritten, it comes back as a conflict with its current content (optimistic locking,
 * as ADR 0008 of IBA-Salesforce).
 */
public with sharing class SfibaAccountController {
    /** Rows per call at most; the client asks page after page. */
    public static final Integer MAX_PAGE = 2000;

    public class AccountData {
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

    public class RowPage {
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

    /**
     * The DIBA data of one account, as the button on the account opens it: name, number of
     * rows, last delivery. Null if nothing has been delivered for this account yet. The id
     * of the delivery may have 15 or 18 characters, so both are compared.
     */
    @AuraEnabled(cacheable=false)
    public static AccountData getAccountData(Id accountId) {
        String id18 = String.valueOf(accountId);
        Set<String> keys = new Set<String>{ id18, id18.left(15) };
        List<SFIBA_Account__c> records = [
            SELECT Id, Name, SFIBA_Account_Key__c, SFIBA_Account__c
            FROM SFIBA_Account__c
            WHERE SFIBA_Account__c = :accountId OR SFIBA_Account_Key__c IN :keys
            LIMIT 1
        ];
        if (records.isEmpty()) {
            return null;
        }
        SFIBA_Account__c record = records[0];
        AccountData accountData = new AccountData();
        accountData.recordId = record.Id;
        accountData.name = record.Name;
        accountData.accountKey = record.SFIBA_Account_Key__c;
        accountData.accountId = record.SFIBA_Account__c == null
            ? accountId
            : record.SFIBA_Account__c;
        accountData.rowCount = [
            SELECT COUNT()
            FROM SFIBA_Row__c
            WHERE SFIBA_Account__c = :record.Id
        ];
        AggregateResult[] last = [
            SELECT MAX(SFIBA_Received_At__c) received
            FROM SFIBA_Transmission__c
            WHERE SFIBA_Account__c = :record.Id
        ];
        accountData.lastDelivery = (Datetime) last[0].get('received');
        return accountData;
    }

    /** One page of rows of an account, in the order of their key. */
    @AuraEnabled(cacheable=false)
    public static RowPage getRows(Id accountDataId, String afterKey, Integer pageSize) {
        Integer size = pageSize == null ||
            pageSize < 1 ||
            pageSize > MAX_PAGE
            ? MAX_PAGE
            : pageSize;
        String after = afterKey == null ? '' : afterKey;
        List<SFIBA_Row__c> records = Database.query(
            'SELECT ' +
                SfibaRowFields.selectList() +
                ' FROM SFIBA_Row__c WHERE SFIBA_Account__c = :accountDataId AND SFIBA_Row_Key__c > :after' +
                ' ORDER BY SFIBA_Row_Key__c LIMIT :size'
        );
        RowPage result = new RowPage();
        for (SFIBA_Row__c record : records) {
            result.rows.add(SfibaRowFields.toMap(record));
        }
        if (records.size() == size) {
            result.nextAfter = records[records.size() - 1].SFIBA_Row_Key__c;
        }
        return result;
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
        Map<Id, SFIBA_Row__c> current = new Map<Id, SFIBA_Row__c>(
            [
                SELECT Id, SFIBA_Version__c, SFIBA_Row_Key__c
                FROM SFIBA_Row__c
                WHERE Id IN :ids
                FOR UPDATE
            ]
        );
        Set<Id> conflicting = new Set<Id>();

        List<SFIBA_Row__c> updates = new List<SFIBA_Row__c>();
        List<SFIBA_Master_Edit__c> upserts = new List<SFIBA_Master_Edit__c>();
        Set<String> removals = new Set<String>();
        Datetime now = System.now();
        for (Id rowId : byId.keySet()) {
            SFIBA_Row__c row = current.get(rowId);
            if (row == null) {
                result.errors.put(rowId, 'The row no longer exists.');
                continue;
            }
            Map<String, Object> change = byId.get(rowId);
            Integer stored = row.SFIBA_Version__c == null ? 0 : row.SFIBA_Version__c.intValue();
            Integer expected = change.get('version') == null
                ? 0
                : Integer.valueOf(change.get('version'));
            if (stored != expected) {
                conflicting.add(rowId);
                continue;
            }
            try {
                SFIBA_Row__c changed = new SFIBA_Row__c(Id = rowId);
                Map<String, Object> values = (Map<String, Object>) change.get('values');
                if (values != null) {
                    for (String name : values.keySet()) {
                        SfibaRowFields.Field field = SfibaRowFields.get(name);
                        if (
                            field == null ||
                            (field.kind != SfibaRowFields.Kind.CONSULTANT &&
                            field.kind != SfibaRowFields.Kind.CALCULATED)
                        ) {
                            throw new IllegalArgumentException(name + ' cannot be changed here.');
                        }
                        changed.put(
                            field.token,
                            SfibaRowFields.fromClient(field, values.get(name))
                        );
                    }
                }
                List<Object> edits = (List<Object>) change.get('edits');
                if (edits != null) {
                    for (Object editObject : edits) {
                        Map<String, Object> edit = (Map<String, Object>) editObject;
                        String name = (String) edit.get('field');
                        if (!SfibaRowFields.EDITABLE_MASTER.contains(name)) {
                            throw new IllegalArgumentException(name + ' cannot be changed here.');
                        }
                        String key = row.SFIBA_Row_Key__c + '/' + name;
                        Object value = edit.get('value');
                        if (value == null) {
                            removals.add(key);
                        } else {
                            upserts.add(
                                new SFIBA_Master_Edit__c(
                                    SFIBA_Edit_Key__c = key,
                                    SFIBA_Row__c = rowId,
                                    SFIBA_Field__c = name,
                                    SFIBA_Value__c = String.valueOf(value),
                                    SFIBA_Salesforce_Value__c = edit.get('salesforceValue') == null
                                        ? null
                                        : String.valueOf(edit.get('salesforceValue'))
                                )
                            );
                        }
                    }
                }
                changed.SFIBA_Version__c = stored + 1;
                changed.SFIBA_Consultant_Updated_At__c = now;
                updates.add(changed);
                result.saved.put(rowId, stored + 1);
            } catch (Exception e) {
                result.errors.put(rowId, e.getMessage());
            }
        }
        if (!conflicting.isEmpty()) {
            for (
                SFIBA_Row__c row : (List<SFIBA_Row__c>) Database.query(
                    'SELECT ' +
                        SfibaRowFields.selectList() +
                        ' FROM SFIBA_Row__c WHERE Id IN :conflicting'
                )
            ) {
                result.conflicts.add(SfibaRowFields.toMap(row));
            }
        }
        update updates;
        if (!upserts.isEmpty()) {
            upsert upserts SFIBA_Master_Edit__c.Fields.SFIBA_Edit_Key__c;
        }
        if (!removals.isEmpty()) {
            delete [SELECT Id FROM SFIBA_Master_Edit__c WHERE SFIBA_Edit_Key__c IN :removals];
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
        SFIBA_Row__c row = (SFIBA_Row__c) Database.query(
            'SELECT ' + SfibaRowFields.selectList() + ' FROM SFIBA_Row__c WHERE Id = :rowId'
        )[0];
        String code = SfibaOrderCodes.effectiveCode(row);
        Map<String, String> results;
        try {
            results = SfibaOrderCodes.lookup(new Set<String>{ code });
        } catch (SfibaOrderCodes.TransformerException e) {
            throw new AuraHandledException(e.getMessage());
        }
        SFIBA_Row__c changed = new SFIBA_Row__c(Id = row.Id, SFIBA_Order_Code_Pending__c = false);
        if (SfibaOrderCodes.apply(results.get(code), row)) {
            changed.SFIBA_Add_Ordercode_Transform__c = row.SFIBA_Add_Ordercode_Transform__c;
            changed.SFIBA_Add_Recomend_Ordercode__c = row.SFIBA_Add_Recomend_Ordercode__c;
            changed.SFIBA_Version__c =
                (row.SFIBA_Version__c == null ? 0 : row.SFIBA_Version__c) + 1;
        }
        update changed;
        return SfibaRowFields.toMap(
            (SFIBA_Row__c) Database.query(
                'SELECT ' + SfibaRowFields.selectList() + ' FROM SFIBA_Row__c WHERE Id = :rowId'
            )[0]
        );
    }
}
