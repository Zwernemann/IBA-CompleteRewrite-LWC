import { createElement } from "lwc";
import SfibaReport from "c/sfibaReport";
import { CurrentPageReference } from "lightning/navigation";
import getAccountData from "@salesforce/apex/SfibaAccountController.getAccountData";
import listAccounts from "@salesforce/apex/SfibaAccountController.listAccounts";

const mockNavigate = jest.fn();

jest.mock("lightning/navigation", () => {
    const actual = jest.requireActual("lightning/navigation");
    const Navigate = Symbol("Navigate");
    const NavigationMixin = (Base) =>
        class extends Base {
            [Navigate](reference) {
                mockNavigate(reference);
            }
        };
    NavigationMixin.Navigate = Navigate;
    return { ...actual, NavigationMixin };
});
jest.mock("@salesforce/apex/SfibaAccountController.getAccountData", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/SfibaAccountController.listAccounts", () => ({ default: jest.fn() }), { virtual: true });

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
        listAccounts.mockReset();
        mockNavigate.mockReset();
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

    it("says that nothing was delivered yet when called without an account and there is none", async () => {
        listAccounts.mockResolvedValue([]);
        const element = createElement("c-sfiba-report", { is: SfibaReport });
        document.body.appendChild(element);
        CurrentPageReference.emit({ state: {} });
        await settle();
        expect(element.shadowRoot.querySelector('[data-id="no-account"]')).not.toBeNull();
        expect(getAccountData).not.toHaveBeenCalled();
    });

    it("lists the delivered accounts when called without one and opens the chosen", async () => {
        listAccounts.mockResolvedValue([
            { recordId: "a01A", name: "DIBA Testanlage Nord", accountKey: "0017Q00000TsTdAQAV", accountId: "0017Q00000TsTdAQAV" },
            { recordId: "a01B", name: "Ohne Account", accountKey: "0017Q00000TsTeAQAV", accountId: null }
        ]);
        const element = createElement("c-sfiba-report", { is: SfibaReport });
        document.body.appendChild(element);
        CurrentPageReference.emit({ state: {} });
        await settle();
        const buttons = element.shadowRoot.querySelectorAll('[data-id="accounts"] button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].textContent).toContain("DIBA Testanlage Nord");
        buttons[1].click();
        expect(mockNavigate).toHaveBeenCalledWith({
            type: "standard__navItemPage",
            attributes: { apiName: "mzw__SFIBA_Report" },
            state: { mzw__account: "0017Q00000TsTeAQAV" }
        });
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
