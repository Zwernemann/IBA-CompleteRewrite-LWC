// Sign-in, navigation and queries for the end to end tests.
const { execFileSync } = require("node:child_process");

const ORG = process.env.E2E_ORG || "testorg";
const FRONTDOOR = process.env.E2E_FRONTDOOR;
const TEST_ACCOUNT_NAME = "DIBA Testanlage Nord";

/** A SOQL query through the CLI, as JSON records. */
function query(soql) {
    const out = execFileSync("sf", ["data", "query", "--query", soql, "--target-org", ORG, "--json"], {
        encoding: "utf8"
    });
    return JSON.parse(out).result.records;
}

/** The id of the test account, to which scripts/apex/send-testdata.apex delivered. */
function testAccountId() {
    const records = query(`SELECT Id FROM Account WHERE Name = '${TEST_ACCOUNT_NAME}' LIMIT 1`);
    if (!records.length) throw new Error(`Account "${TEST_ACCOUNT_NAME}" missing; run scripts/org-install-test.sh first`);
    return records[0].Id;
}

/**
 * Signs in through the frontdoor address and opens the work surface of the test account,
 * as the button "DIBA Report" on the account does.
 */
async function openTestAccount(page) {
    if (!FRONTDOOR) throw new Error("E2E_FRONTDOOR is not set; run the tests with scripts/e2e.sh");
    await page.goto(FRONTDOOR);
    await page.waitForURL(/lightning/, { timeout: 120000 });
    const base = new URL(page.url()).origin;
    await page.goto(`${base}/lightning/n/mzw__DIBA_Report?mzw__account=${testAccountId()}`);
    await page.getByText(TEST_ACCOUNT_NAME).first().waitFor();
}

/** Waits until a query returns records, or fails after the timeout. */
async function eventually(soql, test = (records) => records.length > 0, timeout = 60000) {
    const end = Date.now() + timeout;
    let records = [];
    while (Date.now() < end) {
        records = query(soql);
        if (test(records)) return records;
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Not found in time: ${soql}\nLast result: ${JSON.stringify(records)}`);
}

module.exports = { openTestAccount, query, eventually, testAccountId, TEST_ACCOUNT_NAME };
