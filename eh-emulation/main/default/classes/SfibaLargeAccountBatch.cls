/**
 * Delivers the parts of the load test account (SfibaLargeAccount) one after another, one
 * part per execution, so each part has the limits of a transaction of its own. The order
 * code successors are not looked up for the load test; the rows stay pending until their
 * next delivery. Only for test orgs.
 */
public with sharing class SfibaLargeAccountBatch implements Database.Batchable<Integer> {
    private final String accountId;
    private final String accountName;
    private final Integer rows;
    private final Integer parts;
    private final String transmissionId;

    public SfibaLargeAccountBatch(
        String accountId,
        String accountName,
        Integer rows,
        Integer parts,
        String transmissionId
    ) {
        this.accountId = accountId;
        this.accountName = accountName;
        this.rows = rows;
        this.parts = parts;
        this.transmissionId = transmissionId;
    }

    public Iterable<Integer> start(Database.BatchableContext context) {
        List<Integer> numbers = new List<Integer>();
        for (Integer part = 1; part <= parts; part++) {
            numbers.add(part);
        }
        return numbers;
    }

    public void execute(Database.BatchableContext context, List<Integer> numbers) {
        for (Integer part : numbers) {
            SfibaImport.accept(
                SfibaLargeAccount.build(accountId, accountName, rows, part, transmissionId)
            );
        }
    }

    public void finish(Database.BatchableContext context) {
        return;
    }
}
