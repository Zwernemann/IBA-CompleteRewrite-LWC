import { createElement } from "lwc";
import DibaPlant from "c/dibaPlant";
import DibaMaintenanceModal from "c/dibaMaintenanceModal";

jest.mock("c/dibaMaintenanceModal", () => ({ __esModule: true, default: { open: jest.fn() } }));

describe("c-diba-plant", () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it("shows the seven tabs and opens the asset table", async () => {
        DibaMaintenanceModal.open.mockResolvedValue("closed");
        const element = createElement("c-diba-plant", { is: DibaPlant });
        element.plant = { recordId: "a01A", name: "Nord", rowCount: 20 };
        const changed = jest.fn();
        element.addEventListener("changed", changed);
        document.body.appendChild(element);
        await Promise.resolve();

        expect(element.shadowRoot.querySelectorAll("lightning-tab").length).toBe(7);
        element.shadowRoot.querySelector('[data-id="open-assets"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(DibaMaintenanceModal.open).toHaveBeenCalledWith(
            expect.objectContaining({ size: "full", plantId: "a01A", plantName: "Nord" })
        );
        expect(changed).toHaveBeenCalled();
    });
});
