import { createElement } from "lwc";
import DibaOpenReport from "c/dibaOpenReport";

const mockNavigate = jest.fn();

jest.mock("lightning/navigation", () => {
    const Navigate = Symbol("Navigate");
    const NavigationMixin = (Base) =>
        class extends Base {
            [Navigate](reference) {
                mockNavigate(reference);
            }
        };
    NavigationMixin.Navigate = Navigate;
    return { NavigationMixin };
});

describe("c-diba-open-report", () => {
    it("opens the tab DIBA Report for the account", () => {
        const element = createElement("c-diba-open-report", { is: DibaOpenReport });
        element.recordId = "0017Q00000TsTdAQAV";
        document.body.appendChild(element);
        element.invoke();
        expect(mockNavigate).toHaveBeenCalledWith({
            type: "standard__navItemPage",
            attributes: { apiName: "mzw__DIBA_Report" },
            state: { mzw__account: "0017Q00000TsTdAQAV" }
        });
    });
});
