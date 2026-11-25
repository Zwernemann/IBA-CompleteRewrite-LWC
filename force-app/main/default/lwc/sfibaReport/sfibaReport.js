import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import getAccountData from "@salesforce/apex/SfibaAccountController.getAccountData";

/**
 * The work surface of SF Frontend IBA for one account, full page. Opened by the
 * button "SF IBA Report" on the account (c/sfibaOpenReport), which passes the account id as
 * mzw__account (c__account where the package has no namespace).
 */
export default class SfibaReport extends LightningElement {
    accountId;
    account;
    loading = true;
    error;

    @wire(CurrentPageReference)
    setPageReference(reference) {
        const state = (reference && reference.state) || {};
        const accountId = state.mzw__account || state.c__account || null;
        if (accountId !== this.accountId) {
            this.accountId = accountId;
            this.load();
        }
    }

    async load() {
        this.account = null;
        this.error = null;
        if (!this.accountId) {
            this.loading = false;
            return;
        }
        this.loading = true;
        try {
            this.account = await getAccountData({ accountId: this.accountId });
        } catch (e) {
            this.error = (e && e.body && e.body.message) || String(e);
        } finally {
            this.loading = false;
        }
    }

    get noAccount() {
        return !this.loading && !this.error && !this.accountId;
    }

    get nothingDelivered() {
        return !this.loading && !this.error && this.accountId && !this.account;
    }

    handleChanged() {
        this.load();
    }
}
