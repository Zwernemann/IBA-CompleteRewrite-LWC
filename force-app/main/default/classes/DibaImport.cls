/**
 * Data intake of the DIBA Report Generator.
 *
 * E+H's action "DIBA Report" builds the account data of an account as JSON in schema v3
 * (docs/schema/iba-import.schema.json) and used to send it to the Tomcat server. Inside
 * Salesforce it calls this class instead, with the same JSON and in the same parts, and
 * gets the same answer:
 *
 *   String answer = mzw.DibaImport.accept(json);
 *
 * Rules, as for the former endpoint (docs/dateneingang.md):
 * - a delivery adds or replaces rows and never deletes any;
 * - master data is overwritten, consultant input is never touched;
 * - the same part with the same content is recognised and not processed again;
 * - an unknown picklist value does not reject the delivery, it is stored as not set and
 *   named in the answer.
 *
 * Data that does not match the schema raises DibaImport.ImportException with all
 * objections in its message. The messages are part of the interface and stay in German,
 * as they were.
 */
global with sharing class DibaImport {
    /** The data does not match the schema or cannot be read; the message says where. */
    global class ImportException extends Exception {
    }

    /**
     * Processes one part of a delivery.
     *
     * @param json the part, a JSON object in schema v3
     * @return the answer as JSON: transmissionId, part, accountId, rowsAccepted,
     *         tagsWithoutAsset, unknownValues, alreadySeen, complete, openUrl
     */
    global static String accept(String json) {
        return process(json).toJson();
    }

    /** The result of one part. Public for the tests and for the application itself. */
    public class Result {
        public String transmissionId;
        public Integer part;
        public String accountId;
        public Integer rowsAccepted = 0;
        public Integer tagsWithoutAsset = 0;
        public Map<String, Set<String>> unknownValues = new Map<String, Set<String>>();
        public Boolean alreadySeen = false;
        public Boolean complete = false;
        /** Always null inside Salesforce: the consultant opens the account from the account. */
        public String openUrl;

        /** The answer in the order of the former endpoint, values of unknownValues sorted. */
        public String toJson() {
            JSONGenerator out = JSON.createGenerator(false);
            out.writeStartObject();
            out.writeStringField('transmissionId', transmissionId);
            out.writeNumberField('part', part);
            out.writeStringField('accountId', accountId);
            out.writeNumberField('rowsAccepted', rowsAccepted);
            out.writeNumberField('tagsWithoutAsset', tagsWithoutAsset);
            out.writeFieldName('unknownValues');
            out.writeStartObject();
            List<String> fields = new List<String>(unknownValues.keySet());
            fields.sort();
            for (String field : fields) {
                List<String> values = new List<String>(unknownValues.get(field));
                values.sort();
                out.writeFieldName(field);
                out.writeStartArray();
                for (String value : values) {
                    out.writeString(value);
                }
                out.writeEndArray();
            }
            out.writeEndObject();
            out.writeBooleanField('alreadySeen', alreadySeen);
            out.writeBooleanField('complete', complete);
            out.writeNullField('openUrl');
            out.writeEndObject();
            return out.getAsString();
        }
    }

    /** Processes one part and returns the result; all writes or none. */
    public static Result process(String json) {
        DibaImportPayload payload = DibaImportPayload.parse(json);

        Result result = new Result();
        result.transmissionId = payload.transmissionId;
        result.part = payload.part;
        result.accountId = payload.accountId;
        result.tagsWithoutAsset = payload.tagsWithoutAsset;
        result.unknownValues = payload.unknownValues;

        Savepoint rollbackPoint = Database.setSavepoint();
        try {
            DIBA_Account__c accountData = payload.accountData();
            linkAccount(accountData, payload.accountId);
            upsert accountData DIBA_Account__c.Fields.Account_Key__c;

            String key = transmissionKey(payload.transmissionId, payload.part);
            List<DIBA_Transmission__c> seen = [
                SELECT Content_Hash__c
                FROM DIBA_Transmission__c
                WHERE Transmission_Key__c = :key
                LIMIT 1
            ];
            if (!seen.isEmpty() && seen[0].Content_Hash__c == payload.contentHash) {
                result.alreadySeen = true;
            } else {
                DIBA_Transmission__c transmission = new DIBA_Transmission__c(
                    Transmission_Key__c = key,
                    Transmission_Id__c = payload.transmissionId,
                    Part__c = payload.part,
                    Part_Count__c = payload.partCount,
                    Row_Count__c = payload.rows.size(),
                    Content_Hash__c = payload.contentHash,
                    Received_At__c = System.now()
                );
                if (seen.isEmpty()) {
                    // The master-detail field is set on insert only.
                    transmission.DIBA_Account__r = new DIBA_Account__c(
                        Account_Key__c = payload.accountId
                    );
                }
                upsert transmission DIBA_Transmission__c.Fields.Transmission_Key__c;

                Datetime now = System.now();
                for (DIBA_Row__c row : payload.rows) {
                    row.Master_Updated_At__c = now;
                    // The Order Code Transformer looks up the successor afterwards.
                    row.Order_Code_Pending__c = true;
                }
                upsert payload.rows DIBA_Row__c.Fields.Row_Key__c;
                result.rowsAccepted = payload.rows.size();
            }
            result.complete = isComplete(payload.transmissionId);
            if (result.rowsAccepted > 0) {
                DibaOrderCodeJob.startFor(accountData.Id);
            }
        } catch (Exception e) {
            Database.rollback(rollbackPoint);
            throw e;
        }
        return result;
    }

    /** Key of one part of a transmission. */
    public static String transmissionKey(String transmissionId, Integer part) {
        return transmissionId + '#' + part;
    }

    /** Whether all parts of the transmission have arrived. */
    public static Boolean isComplete(String transmissionId) {
        AggregateResult[] counts = [
            SELECT COUNT(Id) parts, MAX(Part_Count__c) expected
            FROM DIBA_Transmission__c
            WHERE Transmission_Id__c = :transmissionId
        ];
        Integer parts = (Integer) counts[0].get('parts');
        Decimal expected = (Decimal) counts[0].get('expected');
        return expected != null && parts == expected;
    }

    /**
     * Sets the lookup to the account when the id of the delivery names an account of this
     * org. A delivery for an account that does not exist here is still stored, as before.
     */
    private static void linkAccount(DIBA_Account__c accountData, String accountId) {
        Id recordId;
        try {
            recordId = Id.valueOf(accountId);
        } catch (Exception e) {
            return;
        }
        if (recordId.getSObjectType() != Account.SObjectType) {
            return;
        }
        List<Account> accounts = [SELECT Id FROM Account WHERE Id = :recordId LIMIT 1];
        if (!accounts.isEmpty()) {
            accountData.Account__c = accounts[0].Id;
        }
    }
}
