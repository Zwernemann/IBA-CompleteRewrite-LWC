import { createElement } from "lwc";
import SfibaMaintenanceModal from "c/sfibaMaintenanceModal";

jest.mock("@salesforce/apex/SfibaAccountController.getRows", () => ({ default: jest.fn(() => new Promise(() => {})) }), {
    virtual: true
});
jest.mock("@salesforce/apex/SfibaAccountController.saveRows", () => ({ default: jest.fn() }), { virtual: true });

describe("c-sfiba-maintenance-modal", () => {
    it("names the account and holds the table", async () => {
        const element = createElement("c-sfiba-maintenance-modal", { is: SfibaMaintenanceModal });
        element.accountDataId = "a01A";
        element.accountName = "Nord";
        document.body.appendChild(element);
        await Promise.resolve();
        expect(element.shadowRoot.querySelector("lightning-modal-header").label).toBe("Assets: Nord");
        expect(element.shadowRoot.querySelector("c-sfiba-maintenance").accountDataId).toBe("a01A");
    });
});
