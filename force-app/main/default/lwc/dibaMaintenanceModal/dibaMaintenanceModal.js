import { api } from "lwc";
import LightningModal from "lightning/modal";

/** The maintenance dialog as a full screen modal. Saves what is pending when closed. */
export default class DibaMaintenanceModal extends LightningModal {
    @api plantId;
    @api plantName;
    /** maintenance, breakdown, migration or preventative, see c/dibaColumns */
    @api view = "maintenance";
    /** The title of the dialog, in the language of the user interface. */
    @api title;

    get heading() {
        return `${this.title || "Assets"}: ${this.plantName || ""}`;
    }

    get gridHeight() {
        return Math.max(300, (window.innerHeight || 800) - 260);
    }

    async handleClose() {
        const table = this.template.querySelector("c-diba-maintenance");
        if (table) {
            await table.flush();
        }
        this.close("closed");
    }
}
