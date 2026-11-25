// The work of a consultant on the test account, as in the e2e suite of IBA-Salesforce:
// tabs, asset table, consultant input, report texts, report XML.
const { test, expect } = require("@playwright/test");
const { openTestAccount, eventually, testAccountId } = require("./helpers");

const stamp = `e2e ${Date.now()}`;

test("the account shows its seven tabs and 20 rows", async ({ page }) => {
    await openTestAccount(page);
    for (const tab of ["Indicators", "Overview", "Standardisation", "Breakdown", "Migration", "Preventative", "Implementation"]) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
    await expect(page.getByText("20 rows").first()).toBeVisible();
});

test("the asset table shows all rows and filters them", async ({ page }) => {
    await openTestAccount(page);
    await page.getByRole("button", { name: "Edit asset table" }).click();
    await expect(page.getByText("20 rows").last()).toBeVisible();
    await page.locator('input.sfiba-filter[data-field="device_tag"]').fill("TI-");
    await expect(page.getByText(/of 20 rows/)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
});

test("a remark in the breakdown table is stored", async ({ page }) => {
    await openTestAccount(page);
    await page.getByRole("tab", { name: "Breakdown" }).click();
    await page.getByRole("button", { name: "Edit extended spare instruments table" }).click();
    const cell = page.locator('.sfiba-cell[data-field="add_remark1"]').first();
    await cell.click();
    const editor = page.locator("input.sfiba-editor");
    await editor.fill(stamp);
    await editor.press("Enter");
    await expect(page.getByText("All changes saved")).toBeVisible();
    await eventually(
        `SELECT Id FROM mzw__SFIBA_Row__c WHERE mzw__Add_Remark1__c = '${stamp}' AND mzw__SFIBA_Account__r.mzw__Account__c = '${testAccountId()}'`
    );
    await page.getByRole("button", { name: "Close" }).click();
});

test("a report text is stored with its version", async ({ page }) => {
    await openTestAccount(page);
    await page.getByRole("tab", { name: "Overview" }).click();
    const editor = page.locator(".sfiba-rich-editor").nth(1);
    await editor.click();
    await editor.press("End");
    await editor.pressSequentially(` ${stamp}`);
    await page.getByRole("tab", { name: "Overview" }).click();
    await eventually(
        `SELECT mzw__Version__c FROM mzw__SFIBA_Report_Value__c WHERE mzw__Value_Name__c = 'overview_reason' AND mzw__Value__c LIKE '%${stamp}%'`
    );
});

test("the report XML has the 20 devices", async ({ page }) => {
    await openTestAccount(page);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Report XML" }).click();
    const file = await download;
    const path = await file.path();
    const xml = require("node:fs").readFileSync(path, "utf8");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')).toBe(true);
    expect((xml.match(/<device>/g) || []).length).toBe(20);
    expect(xml).toContain("<siteName>DIBA Testanlage Nord</siteName>");
});
