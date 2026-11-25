import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import listPlants from "@salesforce/apex/DibaPlantController.listPlants";

/**
 * The tab "DIBA Report": the delivered plants, and the chosen one. Opened with
 * ?c__account=<Account id> (15 or 18 characters) it shows that account's plant directly.
 */
export default class DibaReport extends LightningElement {
    plants = [];
    selected;
    loading = true;
    error;
    requestedAccount;

    columns = [
        { label: "Plant", fieldName: "name", type: "text" },
        { label: "Account", fieldName: "accountKey", type: "text" },
        { label: "Rows", fieldName: "rowCount", type: "number", initialWidth: 110 },
        {
            label: "Last delivery",
            fieldName: "lastDelivery",
            type: "date",
            initialWidth: 190,
            typeAttributes: { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
        },
        {
            type: "button",
            initialWidth: 110,
            typeAttributes: { label: "Open", name: "open", variant: "brand" }
        }
    ];

    @wire(CurrentPageReference)
    setPageReference(reference) {
        const state = (reference && reference.state) || {};
        this.requestedAccount = state.c__account || state.mzw__account || null;
        this.pickRequested();
    }

    connectedCallback() {
        this.load();
    }

    async load() {
        this.loading = true;
        try {
            this.plants = await listPlants();
            if (this.selected) {
                this.selected = this.plants.find((p) => p.recordId === this.selected.recordId);
            }
            this.pickRequested();
        } catch (e) {
            this.error = (e && e.body && e.body.message) || String(e);
        } finally {
            this.loading = false;
        }
    }

    pickRequested() {
        if (!this.requestedAccount || this.selected || this.plants.length === 0) {
            return;
        }
        const wanted = this.requestedAccount.substring(0, 15);
        this.selected = this.plants.find(
            (p) =>
                (p.accountKey && p.accountKey.substring(0, 15) === wanted) ||
                (p.accountId && p.accountId.substring(0, 15) === wanted)
        );
    }

    get hasPlants() {
        return this.plants.length > 0;
    }

    get showList() {
        return !this.selected;
    }

    handleRowAction(event) {
        this.selected = event.detail.row;
    }

    handleBack() {
        this.selected = null;
        this.requestedAccount = null;
        this.load();
    }

    handleChanged() {
        this.load();
    }
}
