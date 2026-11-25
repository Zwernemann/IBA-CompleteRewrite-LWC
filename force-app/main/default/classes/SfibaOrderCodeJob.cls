/**
 * Looks up the successors of the rows a delivery has written (SFIBA_Order_Code_Pending__c), a
 * batch of rows per run, as long as there are any. Started by SfibaImport after a part, or
 * from the account view.
 */
public with sharing class SfibaOrderCodeJob implements Queueable, Database.AllowsCallouts {
    public static final Integer ROWS_PER_RUN = 2000;

    private final Id accountDataId;

    public SfibaOrderCodeJob(Id accountDataId) {
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
        System.enqueueJob(new SfibaOrderCodeJob(accountDataId));
        return true;
    }

    public void execute(QueueableContext context) {
        Boolean more = run(accountDataId);
        if (more && !Test.isRunningTest()) {
            System.enqueueJob(new SfibaOrderCodeJob(accountDataId));
        }
    }

    /** One run; returns whether pending rows remain. */
    public static Boolean run(Id accountDataId) {
        List<SFIBA_Row__c> rows = [
            SELECT
                Id,
                SFIBA_Device_Ordercode__c,
                SFIBA_Add_Ordercode_Transform__c,
                SFIBA_Add_Recomend_Ordercode__c,
                SFIBA_Version__c,
                (
                    SELECT SFIBA_Field__c, SFIBA_Value__c, SFIBA_Salesforce_Value__c
                    FROM SFIBA_Master_Edits__r
                )
            FROM SFIBA_Row__c
            WHERE SFIBA_Account__c = :accountDataId AND SFIBA_Order_Code_Pending__c = TRUE
            ORDER BY SFIBA_Row_Key__c
            LIMIT :ROWS_PER_RUN
        ];
        if (rows.isEmpty()) {
            return false;
        }
        Set<String> codes = new Set<String>();
        for (SFIBA_Row__c row : rows) {
            codes.add(SfibaOrderCodes.effectiveCode(row));
        }
        Map<String, String> results;
        try {
            results = SfibaOrderCodes.lookup(codes);
        } catch (SfibaOrderCodes.TransformerException e) {
            // The rows stay pending; the next delivery or the account view tries again.
            System.debug(LoggingLevel.WARN, e.getMessage());
            return false;
        }
        List<SFIBA_Row__c> updates = new List<SFIBA_Row__c>();
        for (SFIBA_Row__c row : rows) {
            SFIBA_Row__c changed = new SFIBA_Row__c(
                Id = row.Id,
                SFIBA_Order_Code_Pending__c = false
            );
            String code = SfibaOrderCodes.effectiveCode(row);
            if (SfibaOrderCodes.apply(results.get(code), row)) {
                changed.SFIBA_Add_Ordercode_Transform__c = row.SFIBA_Add_Ordercode_Transform__c;
                changed.SFIBA_Add_Recomend_Ordercode__c = row.SFIBA_Add_Recomend_Ordercode__c;
                changed.SFIBA_Version__c =
                    (row.SFIBA_Version__c == null ? 0 : row.SFIBA_Version__c) + 1;
            }
            updates.add(changed);
        }
        update updates;
        return rows.size() == ROWS_PER_RUN;
    }
}
