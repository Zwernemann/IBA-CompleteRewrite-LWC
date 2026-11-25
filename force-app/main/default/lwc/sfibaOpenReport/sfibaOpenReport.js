import { LightningElement, api } from "lwc";
import { NavigationMixin } from "lightning/navigation";

/**
 * The button "SF IBA Report" on the account: opens the work surface for this account full
 * page, in the tab SF IBA Report of the package. A headless quick action, no dialog of its own.
 */
export default class SfibaOpenReport extends NavigationMixin(LightningElement) {
    @api recordId;

    @api invoke() {
        this[NavigationMixin.Navigate]({
            type: "standard__navItemPage",
            attributes: { apiName: "mzw__SFIBA_Report" },
            state: { mzw__account: this.recordId }
        });
    }
}
