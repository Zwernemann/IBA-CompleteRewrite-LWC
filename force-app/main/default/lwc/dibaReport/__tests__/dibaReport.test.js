import { createElement } from "lwc";
import DibaReport from "c/dibaReport";
import { CurrentPageReference } from "lightning/navigation";
import listPlants from "@salesforce/apex/DibaPlantController.listPlants";

jest.mock("@salesforce/apex/DibaPlantController.listPlants", () => ({ default: jest.fn() }), { virtual: true });

const PLANTS = [
    { recordId: "a01A", name: "Nord", accountKey: "0017Q00000TsTdAQAV", accountId: null, rowCount: 20 },
    { recordId: "a01B", name: "Sued", accountKey: "001000000000002AAA", accountId: "001000000000002AAA", rowCount: 5 }
];

async function settle() {
    for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-diba-report", () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        listPlants.mockReset();
    });

    it("lists the plants", async () => {
        listPlants.mockResolvedValue(PLANTS);
        const element = createElement("c-diba-report", { is: DibaReport });
        document.body.appendChild(element);
        await settle();
        const table = element.shadowRoot.querySelector("lightning-datatable");
        expect(table.data.length).toBe(2);
        expect(element.shadowRoot.querySelector("c-diba-plant")).toBeNull();
    });

    it("opens the plant of the account in the address, 15 characters suffice", async () => {
        listPlants.mockResolvedValue(PLANTS);
        const element = createElement("c-diba-report", { is: DibaReport });
        document.body.appendChild(element);
        CurrentPageReference.emit({ state: { c__account: "001000000000002" } });
        await settle();
        const plant = element.shadowRoot.querySelector("c-diba-plant");
        expect(plant).not.toBeNull();
        expect(plant.plant.name).toBe("Sued");
    });

    it("says when nothing was delivered", async () => {
        listPlants.mockResolvedValue([]);
        const element = createElement("c-diba-report", { is: DibaReport });
        document.body.appendChild(element);
        await settle();
        expect(element.shadowRoot.textContent).toContain("No plant has been delivered yet");
    });
});
