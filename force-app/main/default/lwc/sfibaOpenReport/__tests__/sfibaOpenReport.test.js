import { createElement } from "lwc";
import SfibaOpenReport from "c/sfibaOpenReport";

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

describe("c-sfiba-open-report", () => {
    it("opens the tab SF IBA Report for the account", () => {
        const element = createElement("c-sfiba-open-report", { is: SfibaOpenReport });
        const closed = jest.fn();
        element.addEventListener("close", closed);
        document.body.appendChild(element);
        element.recordId = "0017Q00000TsTdAQAV";
        expect(mockNavigate).toHaveBeenCalledWith({
            type: "standard__navItemPage",
            attributes: { apiName: "mzw__SFIBA_Report" },
            state: { mzw__account: "0017Q00000TsTdAQAV" }
        });
        expect(closed).toHaveBeenCalled();
    });
});
