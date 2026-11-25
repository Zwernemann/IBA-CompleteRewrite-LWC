import { createElement } from "lwc";
import DibaIntervalModal from "c/dibaIntervalModal";
import getIntervals from "@salesforce/apex/DibaIntervalController.getIntervals";
import saveCells from "@salesforce/apex/DibaIntervalController.saveCells";

jest.mock("@salesforce/apex/DibaIntervalController.getIntervals", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaIntervalController.saveCells", () => ({ default: jest.fn() }), { virtual: true });

async function settle() {
    for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-diba-interval-modal", () => {
    beforeEach(() => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ en: {} }) }));
        getIntervals.mockResolvedValue({
            rows: [{ id: 86, spk: "TA", assettype: "Temperature, Resistor RTD", low_normal_insp: "60" }],
            defaults: { TA: { low_normal_insp: "48" } },
            versions: { TA: { low_normal_insp: 2 } }
        });
        saveCells.mockResolvedValue({ versions: { low_normal_insp: -1 }, conflicts: {} });
    });

    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    it("shows SPK, asset type and the 18 columns", async () => {
        const element = createElement("c-diba-interval-modal", { is: DibaIntervalModal });
        element.accountDataId = "a01A";
        document.body.appendChild(element);
        await settle();
        const grid = element.shadowRoot.querySelector("c-diba-grid");
        expect(grid.columns).toHaveLength(20);
        expect(grid.rows[0].low_normal_insp).toBe("60");
    });

    it("removes the change when a cell is set back to its default", async () => {
        const element = createElement("c-diba-interval-modal", { is: DibaIntervalModal });
        element.accountDataId = "a01A";
        document.body.appendChild(element);
        await settle();
        element.shadowRoot
            .querySelector("c-diba-grid")
            .dispatchEvent(new CustomEvent("cellchange", { detail: { key: "86", field: "low_normal_insp", value: " 48 " } }));
        await settle();
        expect(saveCells).toHaveBeenCalledWith({
            accountDataId: "a01A",
            spk: "TA",
            valuesJson: JSON.stringify({ low_normal_insp: null }),
            versionsJson: JSON.stringify({ low_normal_insp: 2 })
        });
    });
});
