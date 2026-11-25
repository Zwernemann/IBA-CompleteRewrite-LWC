import { api } from "lwc";
import LightningModal from "lightning/modal";
import { REPORT_LANGUAGES } from "c/sfibaReportState";

/**
 * The report settings (ibaReportSettings.xhtml of IBA-Salesforce). Closes with
 *   { action: "save", settings, maintenanceSpks }   the changed values
 *   { action: "resetAll" }                          "Reset all comments"
 *   undefined                                       cancelled
 */
export default class SfibaReportSettingsModal extends LightningModal {
    @api settings;
    @api maintenanceSpks;
    @api labels = {};

    values = {};
    spks = "";

    connectedCallback() {
        this.values = { ...(this.settings || {}) };
        this.spks = this.maintenanceSpks || "";
    }

    labelOf(key, fallback) {
        return (this.labels && this.labels[key]) || fallback;
    }

    get text() {
        return {
            heading: this.labelOf("crgen.fr.rep.settings", "Report settings"),
            userName: this.labelOf("crgen.fr.user.name", "User name"),
            contact: this.labelOf("crgen.fr.contact.details", "Contact details"),
            type: this.labelOf("crgen.fr.rep.type", "Report type"),
            language: this.labelOf("crgen.fr.rep.language", "Report language"),
            spks: this.labelOf("crgen.fr.maint.spk", "SPKs for maintenance"),
            hidePrice: this.labelOf("crgen.fr.hide.price", "Hide budget price"),
            resetAll: this.labelOf("crgen.fr.reset.comments", "Reset all comments"),
            save: this.labelOf("crgen.fr.save", "Save"),
            cancel: this.labelOf("crgen.fr.cancel", "Cancel")
        };
    }

    get typeOptions() {
        return [
            { value: "draft version", label: this.labelOf("crgen.fr.rep.draft", "Draft version") },
            { value: "final version", label: this.labelOf("crgen.fr.rep.final", "Final version") }
        ];
    }

    get languageOptions() {
        return REPORT_LANGUAGES.map((code) => ({ value: code, label: code.replace("_", "-") }));
    }

    handleChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.type === "checkbox" || event.target.type === "toggle" ? event.target.checked : event.detail.value;
        this.values = { ...this.values, [field]: value };
    }

    handleSpks(event) {
        this.spks = event.detail.value;
    }

    handleSave() {
        this.close({ action: "save", settings: { ...this.values }, maintenanceSpks: this.spks });
    }

    handleResetAll() {
        this.close({ action: "resetAll" });
    }

    handleCancel() {
        this.close();
    }
}
