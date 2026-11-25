import { createElement } from "lwc";
import DibaMaintenanceModal from "c/dibaMaintenanceModal";

jest.mock("@salesforce/apex/DibaAccountController.getRows", () => ({ default: jest.fn(() => new Promise(() => {})) }), {
    virtual: true
});
jest.mock("@salesforce/apex/DibaAccountController.saveRows", () => ({ default: jest.fn() }), { virtual: true });

describe("c-diba-maintenance-modal", () => {
    it("names the account and holds the table", async () => {
        const element = createElement("c-diba-maintenance-modal", { is: DibaMaintenanceModal });
        element.accountDataId = "a01A";
        element.accountName = "Nord";
        document.body.appendChild(element);
        await Promise.resolve();
        expect(element.shadowRoot.querySelector("lightning-modal-header").label).toBe("Assets: Nord");
        expect(element.shadowRoot.querySelector("c-diba-maintenance").accountDataId).toBe("a01A");
    });
});
