import { createElement } from "lwc";
import SfibaReport from "c/sfibaReport";
import { CurrentPageReference } from "lightning/navigation";
import getAccountData from "@salesforce/apex/SfibaAccountController.getAccountData";

jest.mock("@salesforce/apex/SfibaAccountController.getAccountData", () => ({ default: jest.fn() }), { virtual: true });

const ACCOUNT = { recordId: "a01A", name: "DIBA Testanlage Nord", accountKey: "0017Q00000TsTdAQAV", accountId: "0017Q00000TsTdAQAV", rowCount: 20 };

async function settle() {
    for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-sfiba-report", () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
        getAccountData.mockReset();
    });

    it("opens the account the button passed", async () => {
        getAccountData.mockResolvedValue(ACCOUNT);
        const element = createElement("c-sfiba-report", { is: SfibaReport });
        document.body.appendChild(element);
        CurrentPageReference.emit({ state: { mzw__account: "0017Q00000TsTdAQAV" } });
        await settle();
        expect(getAccountData).toHaveBeenCalledWith({ accountId: "0017Q00000TsTdAQAV" });
        expect(element.shadowRoot.querySelector("c-sfiba-account").account.name).toBe("DIBA Testanlage Nord");
    });

    it("says where it is opened from when called without an account", async () => {
        const element = createElement("c-sfiba-report", { is: SfibaReport });
        document.body.appendChild(element);
        CurrentPageReference.emit({ state: {} });
        await settle();
        expect(element.shadowRoot.querySelector('[data-id="no-account"]')).not.toBeNull();
        expect(getAccountData).not.toHaveBeenCalled();
    });

    it("says when nothing was delivered for the account", async () => {
        getAccountData.mockResolvedValue(null);
        const element = createElement("c-sfiba-report", { is: SfibaReport });
        document.body.appendChild(element);
        CurrentPageReference.emit({ state: { c__account: "001000000000002AAA" } });
        await settle();
        expect(element.shadowRoot.querySelector('[data-id="nothing-delivered"]')).not.toBeNull();
    });
});
