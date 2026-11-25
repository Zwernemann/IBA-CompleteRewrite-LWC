import { LightningElement, api } from "lwc";
import DibaMaintenanceModal from "c/dibaMaintenanceModal";

/**
 * One plant with the tabs of the former working page (ibaJob.xhtml). The asset table opens
 * as a full screen dialog, as before.
 */
export default class DibaPlant extends LightningElement {
    @api plant;

    tabs = [
        { value: "indicators", label: "Indicators" },
        { value: "overview", label: "Overview" },
        { value: "standardisation", label: "Standardisation" },
        { value: "breakdown", label: "Breakdown" },
        { value: "migration", label: "Migration" },
        { value: "preventative", label: "Preventative" },
        { value: "implementation", label: "Implementation" }
    ];

    get title() {
        return this.plant ? this.plant.name : "";
    }

    get rowCount() {
        return this.plant ? `${this.plant.rowCount} rows` : "";
    }

    async handleOpenAssets() {
        await DibaMaintenanceModal.open({
            size: "full",
            description: "Asset table of the plant",
            plantId: this.plant.recordId,
            plantName: this.plant.name
        });
        this.dispatchEvent(new CustomEvent("changed"));
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent("back"));
    }
}
