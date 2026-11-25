import { createElement } from "lwc";
import DibaMaintenance from "c/dibaMaintenance";
import getRows from "@salesforce/apex/DibaPlantController.getRows";
import saveRows from "@salesforce/apex/DibaPlantController.saveRows";

jest.mock("@salesforce/apex/DibaPlantController.getRows", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaPlantController.saveRows", () => ({ default: jest.fn() }), { virtual: true });

function row(id, extra = {}) {
    return {
        id,
        version: 0,
        device_oid: id,
        device_tag: `TAG-${id}`,
        supplier_name: "Other",
        device_ordercode: `CODE-${id}`,
        device_accessibility: "easy",
        device_maint_effectivness: "low",
        edits: [],
        ...extra
    };
}

async function settle() {
    for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-diba-maintenance", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        getRows.mockReset();
        saveRows.mockReset();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.useRealTimers();
    });

    async function open() {
        const element = createElement("c-diba-maintenance", { is: DibaMaintenance });
        element.plantId = "a01000000000001AAA";
        document.body.appendChild(element);
        await settle();
        return element;
    }

    it("loads all pages", async () => {
        getRows
            .mockResolvedValueOnce({ rows: [row("1"), row("2")], nextAfter: "k2" })
            .mockResolvedValueOnce({ rows: [row("3")], nextAfter: null });
        const element = await open();

        expect(getRows).toHaveBeenCalledTimes(2);
        expect(getRows.mock.calls[1][0].afterKey).toBe("k2");
        const grid = element.shadowRoot.querySelector("c-diba-grid");
        expect(grid.rows.length).toBe(3);
        expect(grid.rows[0].device_riskofmaint).toBe("low");
    });

    it("saves a master data change as an edit, with the recalculation", async () => {
        getRows.mockResolvedValueOnce({ rows: [row("1")], nextAfter: null });
        saveRows.mockResolvedValue({ saved: { 1: 1 }, conflicts: [], errors: {} });
        const element = await open();

        const grid = element.shadowRoot.querySelector("c-diba-grid");
        grid.dispatchEvent(
            new CustomEvent("cellchange", { detail: { key: "1", field: "device_ordercode", value: "NEW" } })
        );
        grid.dispatchEvent(
            new CustomEvent("cellchange", { detail: { key: "1", field: "device_accessibility", value: "difficult" } })
        );
        jest.advanceTimersByTime(1000);
        await settle();

        expect(saveRows).toHaveBeenCalledTimes(1);
        const [change] = JSON.parse(saveRows.mock.calls[0][0].changesJson);
        expect(change.id).toBe("1");
        expect(change.version).toBe(0);
        expect(change.edits).toEqual([
            { field: "device_ordercode", value: "NEW", salesforceValue: "CODE-1" },
            { field: "device_accessibility", value: "difficult", salesforceValue: "easy" }
        ]);
        expect(change.values.device_riskofmaint).toBe("high");
    });

    it("names a conflict and shows the other version", async () => {
        getRows.mockResolvedValueOnce({ rows: [row("1")], nextAfter: null });
        saveRows.mockResolvedValue({
            saved: {},
            conflicts: [row("1", { version: 3, device_tag: "THEIRS" })],
            errors: {}
        });
        const element = await open();

        const grid = element.shadowRoot.querySelector("c-diba-grid");
        grid.dispatchEvent(new CustomEvent("cellchange", { detail: { key: "1", field: "device_tag", value: "MINE" } }));
        jest.advanceTimersByTime(1000);
        await settle();

        expect(grid.rows[0].device_tag).toBe("THEIRS");
        const alert = element.shadowRoot.querySelector(".slds-alert_warning");
        expect(alert.textContent).toContain("changed by someone else");
    });

    it("rejects a bad date without saving", async () => {
        getRows.mockResolvedValueOnce({ rows: [row("1")], nextAfter: null });
        const element = await open();

        const grid = element.shadowRoot.querySelector("c-diba-grid");
        grid.dispatchEvent(
            new CustomEvent("cellchange", { detail: { key: "1", field: "device_manufacturingdate", value: "1.2.2020" } })
        );
        jest.advanceTimersByTime(1000);
        await settle();

        expect(saveRows).not.toHaveBeenCalled();
        expect(element.shadowRoot.querySelector(".slds-alert_warning").textContent).toContain("is not a date");
    });
});
