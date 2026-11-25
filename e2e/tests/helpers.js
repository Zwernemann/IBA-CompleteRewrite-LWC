// Sign-in, navigation and queries for the end to end tests.
const { execFileSync } = require("node:child_process");

const ORG = process.env.E2E_ORG || "testorg";
const FRONTDOOR = process.env.E2E_FRONTDOOR;
const TEST_ACCOUNT = "0017Q00000TsTdAQAV";

/** Signs in through the frontdoor address and opens the tab DIBA Report of the test plant. */
async function openTestPlant(page) {
    if (!FRONTDOOR) throw new Error("E2E_FRONTDOOR is not set; run the tests with scripts/e2e.sh");
    await page.goto(FRONTDOOR);
    await page.waitForURL(/lightning/, { timeout: 120000 });
    const base = new URL(page.url()).origin;
    await page.goto(`${base}/lightning/n/mzw__DIBA_Report?c__account=${TEST_ACCOUNT}`);
    await page.getByText("DIBA Testanlage Nord").first().waitFor();
}

/** A SOQL query through the CLI, as JSON records. */
function query(soql) {
    const out = execFileSync("sf", ["data", "query", "--query", soql, "--target-org", ORG, "--json"], {
        encoding: "utf8"
    });
    return JSON.parse(out).result.records;
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

module.exports = { openTestPlant, query, eventually, TEST_ACCOUNT };
