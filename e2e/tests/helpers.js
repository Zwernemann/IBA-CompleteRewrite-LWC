// Sign-in, navigation and queries for the end to end tests.
const { execFileSync } = require("node:child_process");

const ORG = process.env.E2E_ORG || "testorg";
const TEST_ACCOUNT_NAME = "DIBA Testanlage Nord";

/**
 * Runs the Salesforce CLI and reads its JSON answer. The CLI may put a coloured notice
 * about a newer version in front of it; the answer starts at the first brace.
 */
function sf(args) {
    const out = execFileSync("sf", [...args, "--target-org", ORG, "--json"], {
        encoding: "utf8",
        env: { ...process.env, SF_SKIP_NEW_VERSION_CHECK: "true", FORCE_COLOR: "0" }
    });
    const start = out.indexOf("{");
    if (start < 0) throw new Error(`No JSON from sf ${args.join(" ")}: ${out}`);
    const answer = JSON.parse(out.slice(start));
    if (answer.status !== 0) throw new Error(answer.message || JSON.stringify(answer));
    return answer.result;
}

/** A SOQL query through the CLI, as JSON records. */
function query(soql) {
    return sf(["data", "query", "--query", soql]).records;
}

/** The id of the test account, to which scripts/apex/send-testdata.apex delivered. */
function testAccountId() {
    const records = query(`SELECT Id FROM Account WHERE Name = '${TEST_ACCOUNT_NAME}' LIMIT 1`);
    if (!records.length) throw new Error(`Account "${TEST_ACCOUNT_NAME}" missing; run scripts/org-install-test.sh first`);
    return records[0].Id;
}

/**
 * Signs in through a frontdoor address and opens the work surface of the test account,
 * as the button "SF IBA Report" on the account does. Each test asks for an address of its
 * own: one serves a single sign-in only.
 */
async function openTestAccount(page) {
    // The address leads straight to the page: signing in to the start page sends the
    // browser on to the Setup domain, and that reload cut off the next navigation.
    const path = `/lightning/n/mzw__SFIBA_Report?mzw__account=${testAccountId()}`;
    await page.goto(sf(["org", "open", "--url-only", "--path", path]).url);
    await page.waitForURL(/mzw__SFIBA_Report/, { timeout: 120000 });
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
