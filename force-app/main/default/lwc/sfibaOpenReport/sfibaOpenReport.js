import { LightningElement, api } from "lwc";
import { NavigationMixin } from "lightning/navigation";

/**
 * The button "SF IBA Report" on the account: opens the work surface for this account full
 * page, in the tab SF IBA Report of the package. A headless quick action, no dialog of its own.
 * Its type cannot change once installed (Salesforce refuses the upgrade), so it stays
 * headless; the Salesforce mobile app does not list such actions, and on a phone the app
 * "SF IBA" leads to the accounts instead.
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
