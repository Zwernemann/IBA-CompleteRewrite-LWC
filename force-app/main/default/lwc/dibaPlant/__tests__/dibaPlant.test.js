import { createElement } from "lwc";
import { readFileSync } from "fs";
import { join } from "path";
import DibaPlant from "c/dibaPlant";
import DibaMaintenanceModal from "c/dibaMaintenanceModal";
import loadValues from "@salesforce/apex/DibaReportValuesController.load";
import saveValues from "@salesforce/apex/DibaReportValuesController.save";
import getIntervals from "@salesforce/apex/DibaIntervalController.getIntervals";
import getRows from "@salesforce/apex/DibaPlantController.getRows";
import listAttachments from "@salesforce/apex/DibaAttachmentController.listAttachments";
import { forgetRows } from "c/dibaRowStore";

jest.mock("c/dibaMaintenanceModal", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("c/dibaIntervalModal", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("@salesforce/apex/DibaReportValuesController.load", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaReportValuesController.save", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaIntervalController.getIntervals", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaPlantController.getRows", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaAttachmentController.listAttachments", () => ({ default: jest.fn() }), { virtual: true });

const ROOT = join(__dirname, "../../../../../..");
const TRANSLATIONS = JSON.parse(readFileSync(join(ROOT, "force-app/main/default/staticresources/dibaTranslations.json"), "utf8"));

const PLANT = { recordId: "a01A", name: "Nord", accountKey: "0017Q00000TsTdAQAV", rowCount: 2 };

async function settle() {
    for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-diba-plant", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        forgetRows("a01A");
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(TRANSLATIONS) }));
        loadValues.mockResolvedValue({ texts: {}, settings: {}, jobId: PLANT.accountKey, siteName: "Nord", presetLanguage: "de_DE", presetFinalReport: null });
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
        const element = createElement("c-diba-plant", { is: DibaPlant });
        element.plant = PLANT;
        document.body.appendChild(element);
        await settle();
        return element;
    }

    it("shows the seven tabs with the templates of the preset language", async () => {
        const element = await open();
        expect(element.shadowRoot.querySelectorAll("lightning-tab").length).toBe(7);
        const editors = element.shadowRoot.querySelectorAll("c-diba-rich-text");
        expect(editors.length).toBe(22);
        expect(editors[0].value).toContain("Aktuelle Situation");
    });

    it("has an attachment slot in every tab, filled where a file is stored", async () => {
        const element = await open();
        const slots = element.shadowRoot.querySelectorAll("c-diba-attachment");
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
        const editor = element.shadowRoot.querySelector('c-diba-rich-text[data-id], c-diba-rich-text');
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
            .querySelector("c-diba-rich-text")
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

    it("opens the asset table", async () => {
        DibaMaintenanceModal.open.mockResolvedValue("closed");
        const element = await open();
        element.shadowRoot.querySelector('[data-id="open-assets"]').click();
        await settle();
        expect(DibaMaintenanceModal.open).toHaveBeenCalledWith(expect.objectContaining({ plantId: "a01A", view: "maintenance" }));
    });

    it("opens the other dialogs in their view", async () => {
        DibaMaintenanceModal.open.mockResolvedValue("closed");
        const element = await open();
        element.shadowRoot.querySelector('[data-id="open-migration"]').click();
        await settle();
        expect(DibaMaintenanceModal.open).toHaveBeenLastCalledWith(
            expect.objectContaining({ view: "migration", title: "Edit extended migration table" })
        );
    });
});
