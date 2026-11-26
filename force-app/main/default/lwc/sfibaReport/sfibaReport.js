import { LightningElement, wire } from "lwc";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import getAccountData from "@salesforce/apex/SfibaAccountController.getAccountData";
import listAccounts from "@salesforce/apex/SfibaAccountController.listAccounts";

/**
 * The work surface of SF Frontend IBA for one account, full page. Opened by the
 * button "SF IBA Report" on the account (c/sfibaOpenReport), which passes the account id as
 * mzw__account (c__account where the package has no namespace). Opened without an account,
 * as from the app "SF IBA" on a phone, it lists the accounts with delivered data.
 */
export default class SfibaReport extends NavigationMixin(LightningElement) {
    accountId;
    account;
    accounts = [];
    /** The state parameter the tab was opened with: mzw__account in the package. */
    stateKey = "mzw__account";
    loading = true;
    error;

    @wire(CurrentPageReference)
    setPageReference(reference) {
        const state = (reference && reference.state) || {};
        const accountId = state.mzw__account || state.c__account || null;
        this.stateKey = state.c__account && !state.mzw__account ? "c__account" : "mzw__account";
        if (accountId !== this.accountId) {
            this.accountId = accountId;
            this.load();
        }
    }

    async load() {
        this.account = null;
        this.error = null;
        this.loading = true;
        if (!this.accountId) {
            try {
                const accounts = await listAccounts();
                this.accounts = (accounts || []).map((a) => ({
                    key: a.recordId,
                    name: a.name,
                    target: a.accountId || a.accountKey,
                    delivered: a.lastDelivery ? new Date(a.lastDelivery).toLocaleDateString() : ""
                }));
            } catch (e) {
                this.error = (e && e.body && e.body.message) || String(e);
            } finally {
                this.loading = false;
            }
            return;
        }
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

    get hasAccounts() {
        return this.accounts.length > 0;
    }

    /** Opens the chosen account in this tab, the way the button on the account does. */
    handleOpenAccount(event) {
        const target = event.currentTarget.dataset.target;
        this[NavigationMixin.Navigate]({
            type: "standard__navItemPage",
            attributes: { apiName: this.stateKey === "c__account" ? "SFIBA_Report" : "mzw__SFIBA_Report" },
            state: { [this.stateKey]: target }
        });
    }

    get nothingDelivered() {
        return !this.loading && !this.error && this.accountId && !this.account;
    }

    handleChanged() {
        this.load();
    }
}
