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
jest.mock("@salesforce/client/formFactor", () => ({ default: "Small" }), { virtual: true });

const ROOT = join(__dirname, "../../../../../..");
const TRANSLATIONS = JSON.parse(readFileSync(join(ROOT, "force-app/main/default/staticresources/sfibaTranslations.json"), "utf8"));

const ACCOUNT = { recordId: "a01A", name: "Nord", accountKey: "0017Q00000TsTdAQAV", rowCount: 2 };

async function settle() {
    for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-sfiba-account on a phone", () => {
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

    it("has one menu instead of the row of buttons", async () => {
        const element = await open();
        expect(element.shadowRoot.querySelector('[data-id="menu"]')).not.toBeNull();
        expect(element.shadowRoot.querySelector('[data-id="report"]')).toBeNull();
        const items = [...element.shadowRoot.querySelectorAll("lightning-menu-item")].map((item) => item.value);
        expect(items).toEqual(["report", "pdf", "xml", "settings"]);
    });

    it("offers the report XML for the share sheet instead of a download", async () => {
        const element = await open();
        element.shadowRoot.querySelector('[data-id="menu"]').dispatchEvent(new CustomEvent("select", { detail: { value: "xml" } }));
        await settle();
        await settle();
        expect(element.shadowRoot.querySelector('[data-id="pending-xml"]')).not.toBeNull();
        expect(element.shadowRoot.querySelector('[data-id="share-xml"]')).not.toBeNull();
    });
});
