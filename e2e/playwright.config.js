// End to end tests against an org with the packages installed (scripts/e2e.sh).
// E2E_FRONTDOOR is the sign-in address of the org, E2E_ORG its alias for queries.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "tests",
    timeout: 180000,
    expect: { timeout: 30000 },
    workers: 1,
    retries: 0,
    reporter: [["list"], ["html", { outputFolder: "../target/e2e/report", open: "never" }]],
    outputDir: "../target/e2e/results",
    use: {
        viewport: { width: 1600, height: 1000 },
        screenshot: "only-on-failure",
        actionTimeout: 30000
    }
});
