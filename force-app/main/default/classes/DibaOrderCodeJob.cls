/**
 * Looks up the successors of the rows a delivery has written (Order_Code_Pending__c), a
 * batch of rows per run, as long as there are any. Started by DibaImport after a part, or
 * from the account view.
 */
public with sharing class DibaOrderCodeJob implements Queueable, Database.AllowsCallouts {
    public static final Integer ROWS_PER_RUN = 2000;

    private final Id accountDataId;

    public DibaOrderCodeJob(Id accountDataId) {
        this.accountDataId = accountDataId;
    }

    /**
     * Tests that deliver data do not start the job: its callout would fail without a mock.
     * The tests of the job itself switch it on.
     */
    @TestVisible
    private static Boolean startInTests = false;

    /**
     * Starts the job for an account if this transaction may start one. Inside a Queueable,
     * a batch or a future the job is left to the caller: the rows stay pending.
     */
    public static Boolean startFor(Id accountDataId) {
        if (
            accountDataId == null ||
            (Test.isRunningTest() && !startInTests) ||
            System.isQueueable() ||
            System.isBatch() ||
            System.isFuture() ||
            Limits.getQueueableJobs() >= Limits.getLimitQueueableJobs()
        ) {
            return false;
        }
        System.enqueueJob(new DibaOrderCodeJob(accountDataId));
        return true;
    }

    public void execute(QueueableContext context) {
        Boolean more = run(accountDataId);
        if (more && !Test.isRunningTest()) {
            System.enqueueJob(new DibaOrderCodeJob(accountDataId));
        }
    }

    /** One run; returns whether pending rows remain. */
    public static Boolean run(Id accountDataId) {
        List<DIBA_Row__c> rows = [
            SELECT
                Id,
                Device_Ordercode__c,
                Add_Ordercode_Transform__c,
                Add_Recomend_Ordercode__c,
                Version__c,
                (SELECT Field__c, Value__c, Salesforce_Value__c FROM Master_Edits__r)
            FROM DIBA_Row__c
            WHERE DIBA_Account__c = :accountDataId AND Order_Code_Pending__c = TRUE
            ORDER BY Row_Key__c
            LIMIT :ROWS_PER_RUN
        ];
        if (rows.isEmpty()) {
            return false;
        }
        Set<String> codes = new Set<String>();
        for (DIBA_Row__c row : rows) {
            codes.add(DibaOrderCodes.effectiveCode(row));
        }
        Map<String, String> results;
        try {
            results = DibaOrderCodes.lookup(codes);
        } catch (DibaOrderCodes.TransformerException e) {
            // The rows stay pending; the next delivery or the account view tries again.
            System.debug(LoggingLevel.WARN, e.getMessage());
            return false;
        }
        List<DIBA_Row__c> updates = new List<DIBA_Row__c>();
        for (DIBA_Row__c row : rows) {
            DIBA_Row__c changed = new DIBA_Row__c(Id = row.Id, Order_Code_Pending__c = false);
            String code = DibaOrderCodes.effectiveCode(row);
            if (DibaOrderCodes.apply(results.get(code), row)) {
                changed.Add_Ordercode_Transform__c = row.Add_Ordercode_Transform__c;
                changed.Add_Recomend_Ordercode__c = row.Add_Recomend_Ordercode__c;
                changed.Version__c = (row.Version__c == null ? 0 : row.Version__c) + 1;
            }
            updates.add(changed);
        }
        update updates;
        return rows.size() == ROWS_PER_RUN;
    }
}
