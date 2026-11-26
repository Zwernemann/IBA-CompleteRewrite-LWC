import { createElement } from "lwc";
import { readFileSync } from "fs";
import { join } from "path";
import SfibaAccount from "c/sfibaAccount";
import SfibaMaintenanceModal from "c/sfibaMaintenanceModal";
import loadValues from "@salesforce/apex/SfibaReportValuesController.load";
import saveValues from "@salesforce/apex/SfibaReportValuesController.save";
import getIntervals from "@salesforce/apex/SfibaIntervalController.getIntervals";
import getRows from "@salesforce/apex/SfibaAccountController.getRows";
import listAttachments from "@salesforce/apex/SfibaAttachmentController.listAttachments";
import { forgetRows } from "c/sfibaRowStore";
import { downloadPdf, pdfBlob, preload } from "c/crgenerator";
import saveReportPdf from "@salesforce/apex/SfibaAttachmentController.saveReportPdf";

jest.mock("c/sfibaMaintenanceModal", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("c/sfibaIntervalModal", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("@salesforce/apex/SfibaReportValuesController.load", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/SfibaReportValuesController.save", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/SfibaIntervalController.getIntervals", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/SfibaAccountController.getRows", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/SfibaAttachmentController.listAttachments", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/SfibaAttachmentController.saveReportPdf", () => ({ default: jest.fn() }), { virtual: true });

const ROOT = join(__dirname, "../../../../../..");
const TRANSLATIONS = JSON.parse(readFileSync(join(ROOT, "force-app/main/default/staticresources/sfibaTranslations.json"), "utf8"));

const ACCOUNT = { recordId: "a01A", name: "Nord", accountKey: "0017Q00000TsTdAQAV", rowCount: 2 };

async function settle() {
    for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-sfiba-account", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        forgetRows("a01A");
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(TRANSLATIONS) }));
        loadValues.mockResolvedValue({ texts: {}, settings: {}, jobId: ACCOUNT.accountKey, siteName: "Nord", presetLanguage: "de_DE", presetFinalReport: null });
        saveValues.mockResolvedValue({ versions: {}, conflicts: {} });
        getRows.mockResolvedValue({
            rows: [
                { id: "r1", device_oid: "1", device_criticality: "high", device_accessibility: "difficult", device_maint_effectivness: "high", supplier_name: "Endress+Hauser", edits: [] },
                { id: "r2", device_oid: "2", device_criticality: "low", device_accessibility: "easy", device_maint_effectivness: "low", supplier_name: "Other", edits: [] }
            ],
            nextAfter: null
        });
        getIntervals.mockResolvedValue({ rows: [{ id: 1, spk: "TA", assettype: "Temperature" }] });
        listAttachments.mockResolvedValue({ 3: { slot: 3, documentId: "069A", fileName: "plan.pdf", size: 100 } });
    });

    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
        jest.useRealTimers();
    });

    async function open() {
        const element = createElement("c-sfiba-account", { is: SfibaAccount });
        element.account = ACCOUNT;
        document.body.appendChild(element);
        await settle();
        return element;
    }

    it("shows the seven tabs with the templates of the preset language", async () => {
        const element = await open();
        expect(element.shadowRoot.querySelectorAll("lightning-tab").length).toBe(7);
        const editors = element.shadowRoot.querySelectorAll("c-sfiba-rich-text");
        expect(editors.length).toBe(22);
        expect(editors[0].value).toContain("Aktuelle Situation");
    });

    it("has an attachment slot in every tab, filled where a file is stored", async () => {
        const element = await open();
        const slots = element.shadowRoot.querySelectorAll("c-sfiba-attachment");
        expect(slots.length).toBe(7);
        expect(slots[3].attachment.fileName).toBe("plan.pdf");
        expect(slots[0].attachment).toBeNull();
    });

    it("calculates the two sliders from the rows", async () => {
        const element = await open();
        const sliders = element.shadowRoot.querySelectorAll("lightning-slider");
        // high/high -> maintenance 100, criticality 100 (the low row does not count)
        expect(sliders[2].value).toBe(100);
        expect(sliders[2].disabled).toBe(true);
    });

    it("saves a changed text with its section and versions", async () => {
        const element = await open();
        const editor = element.shadowRoot.querySelector('c-sfiba-rich-text[data-id], c-sfiba-rich-text');
        editor.dispatchEvent(new CustomEvent("change", { detail: { name: "overview_reason", value: "<b>mine</b>" } }));
        jest.advanceTimersByTime(1000);
        await settle();
        const calls = saveValues.mock.calls.map((call) => call[0]);
        // The preset language is a setting not stored yet; it is not saved by itself.
        const texts = calls.find((call) => call.section === "texts");
        expect(JSON.parse(texts.valuesJson)).toEqual({ overview_reason: '"<b>mine</b>"' });
        expect(JSON.parse(texts.versionsJson)).toEqual({});
    });

    it("names a conflict", async () => {
        saveValues.mockResolvedValue({ versions: {}, conflicts: { overview_reason: 4 } });
        const element = await open();
        element.shadowRoot
            .querySelector("c-sfiba-rich-text")
            .dispatchEvent(new CustomEvent("change", { detail: { name: "overview_reason", value: "x" } }));
        jest.advanceTimersByTime(1000);
        await settle();
        expect(element.shadowRoot.querySelector(".slds-alert_warning").textContent).toContain("overview_reason");
    });

    it("builds the report XML from rows, texts, settings and intervals", async () => {
        const element = await open();
        const xml = await element.buildReportXml();
        expect(xml).toContain("<ibadata>");
        expect(xml).toContain("<device_oid>1</device_oid>");
        expect(xml).toContain("<siteName>Nord</siteName>");
        expect(xml).toContain("<reportLanguage>de_DE</reportLanguage>");
        expect(xml).toContain("<hub_last_name>Nord</hub_last_name>");
        expect(xml).toContain("<spk>TA</spk>");
    });

    it("creates the report with the CRGenerator from the report XML", async () => {
        const element = await open();
        expect(preload).toHaveBeenCalledWith("IBA Report");
        element.shadowRoot.querySelector('[data-id="report"]').click();
        await settle();
        expect(downloadPdf).toHaveBeenCalledTimes(1);
        const request = downloadPdf.mock.calls[0][0];
        expect(request.report).toBe("IBA Report");
        expect(request.xml).toBe(await element.buildReportXml());
    });

    it("shows the progress above the tabs, not between the buttons, and removes it after", async () => {
        let finish;
        downloadPdf.mockImplementationOnce((request) => {
            request.onProgress({ kind: "phase", phase: "read the data", index: 1, total: 4, ms: 1 });
            return new Promise((resolve) => {
                finish = resolve;
            });
        });
        const element = await open();
        element.shadowRoot.querySelector('[data-id="report"]').click();
        await settle();
        const panel = element.shadowRoot.querySelector('[data-id="report-progress"]');
        expect(panel).not.toBeNull();
        expect(panel.textContent).toContain("Part 1 of 2: IBA_00_0100_00");
        expect(panel.textContent).toContain("read the data (1/4)");
        expect(element.shadowRoot.querySelector('[slot="actions"]').textContent).not.toContain("read the data");
        finish({ delivered: true });
        await settle();
        expect(element.shadowRoot.querySelector('[data-id="report-progress"]')).toBeNull();
    });

    it("saves the report PDF on the account", async () => {
        downloadPdf.mockClear();
        saveReportPdf.mockResolvedValue("069A");
        const element = await open();
        element.shadowRoot.querySelector('[data-id="pdf-to-account"]').click();
        for (let i = 0; i < 5; i++) {
            // FileReader answers in a later task
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => jest.requireActual("timers").setImmediate(resolve));
            // eslint-disable-next-line no-await-in-loop
            await settle();
        }
        expect(pdfBlob).toHaveBeenCalledWith(expect.objectContaining({ report: "IBA Report" }));
        expect(saveReportPdf).toHaveBeenCalledTimes(1);
        const call = saveReportPdf.mock.calls[0][0];
        expect(call.accountDataId).toBe("a01A");
        expect(call.fileName).toBe("IBA Report.pdf");
        expect(atob(call.base64)).toBe("%PDF-1.7 test");
        expect(downloadPdf).not.toHaveBeenCalled();
    });

    it("names a report that failed", async () => {
        downloadPdf.mockRejectedValueOnce(new Error("Unknown report"));
        const element = await open();
        element.shadowRoot.querySelector('[data-id="report"]').click();
        await settle();
        expect(element.shadowRoot.querySelector(".slds-alert_warning").textContent).toContain("Report not created: Unknown report");
    });

    it("opens the asset table", async () => {
        SfibaMaintenanceModal.open.mockResolvedValue("closed");
        const element = await open();
        element.shadowRoot.querySelector('[data-id="open-assets"]').click();
        await settle();
        expect(SfibaMaintenanceModal.open).toHaveBeenCalledWith(expect.objectContaining({ accountDataId: "a01A", view: "maintenance" }));
    });

    it("opens the other dialogs in their view", async () => {
        SfibaMaintenanceModal.open.mockResolvedValue("closed");
        const element = await open();
        element.shadowRoot.querySelector('[data-id="open-migration"]').click();
        await settle();
        expect(SfibaMaintenanceModal.open).toHaveBeenLastCalledWith(
            expect.objectContaining({ view: "migration", title: "Edit extended migration table" })
        );
    });
});
