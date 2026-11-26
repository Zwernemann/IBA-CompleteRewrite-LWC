import { LightningElement, api } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { CloseActionScreenEvent } from "lightning/actions";

/**
 * The button "SF IBA Report" on the account: opens the work surface for this account full
 * page, in the tab SF IBA Report of the package. A screen action that goes on at once and
 * closes: the Salesforce mobile app lists screen actions, not headless ones.
 */
export default class SfibaOpenReport extends NavigationMixin(LightningElement) {
    opened = false;
    accountId;

    @api
    get recordId() {
        return this.accountId;
    }

    set recordId(value) {
        this.accountId = value;
        if (value && !this.opened) {
            this.opened = true;
            this.open();
        }
    }

    open() {
        this[NavigationMixin.Navigate]({
            type: "standard__navItemPage",
            attributes: { apiName: "mzw__SFIBA_Report" },
            state: { mzw__account: this.accountId }
        });
        this.dispatchEvent(new CloseActionScreenEvent());
    }
}
