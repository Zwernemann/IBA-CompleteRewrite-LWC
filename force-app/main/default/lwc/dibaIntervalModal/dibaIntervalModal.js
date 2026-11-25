import { api } from "lwc";
import LightningModal from "lightning/modal";
import getIntervals from "@salesforce/apex/DibaIntervalController.getIntervals";
import saveCells from "@salesforce/apex/DibaIntervalController.saveCells";
import { INTERVAL_COLUMNS } from "c/dibaReportXml";
import { translator } from "c/dibaReportState";
import { loadTranslations, userLanguage } from "c/dibaTexts";

const MAX_LENGTH = 32;

/**
 * The interval table of a plant (ibaIntervalDialog.xhtml of IBA-Salesforce): the defaults
 * of E+H with the cells changed for this plant. A cell set back to its default is no
 * longer a change of the plant. Saved cell by cell as the consultant types.
 */
export default class DibaIntervalModal extends LightningModal {
    @api plantId;
    @api plantName;

    loading = true;
    error;
    rows = [];
    columns = [];
    defaults = {};
    versions = {};
    messages = [];
    t = (key) => key;
    saving = Promise.resolve();

    connectedCallback() {
        this.load();
    }

    get heading() {
        return `${this.t("crgen.fr.edit.interval.tab")}: ${this.plantName || ""}`;
    }

    get gridHeight() {
        return Math.max(300, (window.innerHeight || 800) - 260);
    }

    get hasMessages() {
        return this.messages.length > 0;
    }

    async load() {
        try {
            const [translations, table] = await Promise.all([loadTranslations(), getIntervals({ plantId: this.plantId })]);
            this.t = translator(translations, userLanguage());
            this.defaults = table.defaults || {};
            this.versions = table.versions || {};
            this.rows = table.rows.map((row) => ({ ...row }));
            this.columns = this.buildColumns();
        } catch (e) {
            this.error = (e && e.body && e.body.message) || String(e);
        } finally {
            this.loading = false;
        }
    }

    buildColumns() {
        const t = this.t;
        const kinds = { insp: t("crgen.fr.maint.int.months"), calib: t("crgen.fr.calib.int.months"), valid: t("crgen.fr.valid.int.months") };
        const columns = [
            { field: "spk", label: "SPK", width: 60 },
            { field: "assettype", label: t("crgen.fr.asset.type"), width: 200 }
        ];
        for (const name of INTERVAL_COLUMNS) {
            const [criticality, conditions, kind] = name.split("_");
            columns.push({
                field: name,
                label: `${kinds[kind]}: ${t(`crgen.fr.${criticality}`)} / ${t(`crgen.fr.${conditions}`)}`,
                width: 120,
                editable: () => true
            });
        }
        return columns;
    }

    handleCellChange(event) {
        const { key, field } = event.detail;
        const value = String(event.detail.value || "").trim();
        const row = this.rows.find((r) => String(r.id) === key);
        if (!row) return;
        if (value.length > MAX_LENGTH) {
            this.addMessage(`An interval can have at most ${MAX_LENGTH} characters; the value was not saved.`);
            this.rows = [...this.rows];
            return;
        }
        row[field] = value;
        this.rows = [...this.rows];
        const spk = row.spk;
        const isDefault = value === (this.defaults[spk] || {})[field];
        // One save after the other, so that every save knows the versions of the one before.
        this.saving = this.saving.then(() => this.save(row, field, isDefault ? null : value));
    }

    async save(row, field, value) {
        const spk = row.spk;
        const versions = this.versions[spk] || (this.versions[spk] = {});
        try {
            const result = await saveCells({
                plantId: this.plantId,
                spk,
                valuesJson: JSON.stringify({ [field]: value }),
                versionsJson: JSON.stringify(field in versions ? { [field]: versions[field] } : {})
            });
            for (const [column, version] of Object.entries(result.versions || {})) {
                if (version < 0) delete versions[column];
                else versions[column] = version;
            }
            for (const [column, cell] of Object.entries(result.conflicts || {})) {
                row[column] = cell.exists ? cell.value : (this.defaults[spk] || {})[column];
                if (cell.exists) versions[column] = cell.version;
                else delete versions[column];
                this.addMessage(`${spk}: changed by someone else in the meantime; their value is shown.`);
            }
            this.rows = [...this.rows];
        } catch (e) {
            this.addMessage(`${spk}: ${(e && e.body && e.body.message) || String(e)}`);
        }
    }

    addMessage(text) {
        this.messages = [...this.messages, { id: `${Date.now()}-${this.messages.length}`, text }];
    }

    handleDismiss() {
        this.messages = [];
    }

    async handleClose() {
        await this.saving;
        this.close("closed");
    }
}
