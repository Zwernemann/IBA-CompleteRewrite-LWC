import { createElement } from "lwc";
import DibaMaintenanceModal from "c/dibaMaintenanceModal";

jest.mock("@salesforce/apex/DibaPlantController.getRows", () => ({ default: jest.fn(() => new Promise(() => {})) }), {
    virtual: true
});
jest.mock("@salesforce/apex/DibaPlantController.saveRows", () => ({ default: jest.fn() }), { virtual: true });

describe("c-diba-maintenance-modal", () => {
    it("names the plant and holds the table", async () => {
        const element = createElement("c-diba-maintenance-modal", { is: DibaMaintenanceModal });
        element.plantId = "a01A";
        element.plantName = "Nord";
        document.body.appendChild(element);
        await Promise.resolve();
        expect(element.shadowRoot.querySelector("lightning-modal-header").label).toBe("Assets: Nord");
        expect(element.shadowRoot.querySelector("c-diba-maintenance").plantId).toBe("a01A");
    });
});
