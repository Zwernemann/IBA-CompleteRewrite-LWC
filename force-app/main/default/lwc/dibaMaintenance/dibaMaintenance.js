import { LightningElement, api } from "lwc";
import getRows from "@salesforce/apex/DibaPlantController.getRows";
import saveRows from "@salesforce/apex/DibaPlantController.saveRows";
import {
    CONSULTANT_FIELDS,
    MASTER_FIELDS,
    checkValue,
    editFor,
    isEndressHauser,
    prepareRow,
    refreshCalculated
} from "c/dibaRowLogic";

const PAGE_SIZE = 2000;
const SAVE_DELAY = 800;
const SAVE_BATCH = 500;

const option = (value, label) => ({ value, label: label || value });

const CRITICALITY = [option("low"), option("medium"), option("high"), option("notset")];
const CONDITIONS = [option("normal"), option("heavy"), option("notset")];
const ACCESSIBILITY = [option("easy"), option("moderate"), option("difficult"), option("", "notset")];
const EFFECTIVENESS = [option("low"), option("medium"), option("high")];
const ACTIVITIES = [option("yes"), option("no"), option("", "notset")];
const SPECIAL_DEMANDS = [option("true", "Yes"), option("false", "No")];
const RISK = [option("low"), option("normal"), option("high"), option("notset")];
const OBSOLESCENCE = [option("low"), option("medium"), option("high"), option("notset")];

const always = () => true;
const notEndressHauser = (row) => !isEndressHauser(row);

/**
 * The plant table of the maintenance dialog (ibaMaintDialog.xhtml of IBA-Salesforce): all
 * rows of a plant, master data editable beside the Salesforce values, saved as the
 * consultant types. Rows someone else saved in the meantime are not overwritten: they are
 * reloaded and named.
 */
export default class DibaMaintenance extends LightningElement {
    @api plantId;
    @api height = 560;

    rows = [];
    byId = new Map();
    loading = true;
    loaded = 0;
    error;
    shown = 0;
    messages = [];

    pending = new Map(); // id -> { values, edits }
    saving = false;
    saveTimer;

    columns = [
        { field: "device_tag", label: "Tag", width: 140, editable: always },
        { field: "supplier_name", label: "Manufacturer", width: 130 },
        { field: "device_ordercode", label: "Order code", width: 170, editable: notEndressHauser },
        { field: "device_serialnumber", label: "Serial number", width: 130, editable: notEndressHauser },
        { field: "device_shortname", label: "Product name", width: 150, editable: notEndressHauser },
        { field: "devicetype_spk", label: "SPK", width: 60, editable: notEndressHauser },
        { field: "device_measuringtask", label: "Parameter type", width: 120 },
        {
            field: "device_manufacturingdate",
            label: "Manufacturing date",
            width: 140,
            type: "date",
            editable: notEndressHauser
        },
        { field: "device_criticality", label: "Criticality", width: 110, type: "select", options: CRITICALITY, editable: always },
        { field: "location_name", label: "Location", width: 180 },
        { field: "device_riskofmaint", label: "Risk of maintainability", width: 130, type: "select", options: RISK },
        { field: "device_conditions", label: "Conditions", width: 110, type: "select", options: CONDITIONS, editable: always },
        {
            field: "device_specialdemands",
            label: "Special demands",
            width: 110,
            type: "select",
            options: SPECIAL_DEMANDS,
            editable: always
        },
        { field: "device_property_envrelevant", label: "Environment related", width: 110, type: "checkbox", editable: always },
        { field: "device_property_safetyrelevant", label: "Safety related", width: 110, type: "checkbox", editable: always },
        { field: "device_property_qualityrelevant", label: "Quality related", width: 110, type: "checkbox", editable: always },
        { field: "device_obsolence", label: "Product status", width: 110, type: "select", options: OBSOLESCENCE },
        {
            field: "device_accessibility",
            label: "Accessibility",
            width: 120,
            type: "select",
            options: ACCESSIBILITY,
            editable: always
        },
        {
            field: "device_maint_effectivness",
            label: "Maintenance effectiveness",
            width: 130,
            type: "select",
            options: EFFECTIVENESS,
            editable: always
        },
        { field: "device_activities", label: "Activities", width: 100, type: "select", options: ACTIVITIES, editable: always }
    ];

    connectedCallback() {
        this.load();
    }

    disconnectedCallback() {
        this.flush();
    }

    get progress() {
        return `${this.loaded} rows loaded`;
    }

    get summary() {
        return this.shown === this.rows.length
            ? `${this.rows.length} rows`
            : `${this.shown} of ${this.rows.length} rows`;
    }

    get saveState() {
        if (this.saving) return "Saving";
        if (this.pending.size > 0) return "Changes not yet saved";
        return "All changes saved";
    }

    get hasMessages() {
        return this.messages.length > 0;
    }

    async load() {
        this.loading = true;
        const rows = [];
        let after = null;
        try {
            do {
                // Sequential on purpose: each page starts after the last key of the one before.
                // eslint-disable-next-line no-await-in-loop
                const page = await getRows({ plantId: this.plantId, afterKey: after, pageSize: PAGE_SIZE });
                for (const raw of page.rows) {
                    rows.push(this.prepare({ ...raw }));
                }
                this.loaded = rows.length;
                after = page.nextAfter;
            } while (after);
            this.rows = rows;
            this.byId = new Map(rows.map((row) => [row.id, row]));
            this.shown = rows.length;
        } catch (e) {
            this.error = reduceError(e);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Applies the edits and calculates risk and obsolescence. The calculation is shown and
     * goes into the report; it is stored only with the next change of the row, so that
     * opening a large plant does not write all its rows.
     */
    prepare(row) {
        prepareRow(row);
        refreshCalculated(row);
        return row;
    }

    handleViewChange(event) {
        this.shown = event.detail.shown;
    }

    handleCellChange(event) {
        const { key, field } = event.detail;
        let { value } = event.detail;
        const row = this.byId.get(key);
        if (!row) {
            return;
        }
        if (field === "device_specialdemands") {
            value = value === "true" || value === true;
        }
        const objection = checkValue(field, value);
        if (objection) {
            this.addMessage(`${row.device_tag || row.device_oid}: ${objection}`);
            this.rows = [...this.rows];
            return;
        }
        const change = { values: {}, edits: {} };
        if (MASTER_FIELDS[field]) {
            change.edits[field] = editFor(row, field, value);
            row[field] = value === "" ? null : value;
        } else if (CONSULTANT_FIELDS[field]) {
            change.values[field] = value;
            row[field] = value;
        } else {
            return;
        }
        if (refreshCalculated(row)) {
            change.values.device_riskofmaint = row.device_riskofmaint;
            change.values.device_obsolence = row.device_obsolence;
        }
        this.queue(row, change);
        this.rows = [...this.rows];
    }

    queue(row, change) {
        const entry = this.pending.get(row.id) || { values: {}, edits: {} };
        Object.assign(entry.values, change.values || {});
        Object.assign(entry.edits, change.edits || {});
        this.pending.set(row.id, entry);
        this.scheduleSave();
    }

    scheduleSave() {
        clearTimeout(this.saveTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY);
    }

    /** Saves what is pending; one save at a time, later changes go with the next one. */
    @api
    async flush() {
        clearTimeout(this.saveTimer);
        if (this.saving || this.pending.size === 0) {
            return;
        }
        // At most SAVE_BATCH rows per call, the rest follows with the next one.
        const batch = new Map([...this.pending].slice(0, SAVE_BATCH));
        for (const id of batch.keys()) {
            this.pending.delete(id);
        }
        this.saving = true;
        const changes = [];
        for (const [id, entry] of batch) {
            const row = this.byId.get(id);
            const edits = Object.values(entry.edits);
            changes.push({
                id,
                version: row.version,
                values: entry.values,
                edits
            });
        }
        try {
            const result = await saveRows({ changesJson: JSON.stringify(changes) });
            this.apply(result, batch);
        } catch (e) {
            // Nothing was saved: keep the changes for the next attempt.
            for (const [id, entry] of batch) {
                if (!this.pending.has(id)) {
                    this.pending.set(id, entry);
                }
            }
            this.addMessage(`Saving failed: ${reduceError(e)}`);
        } finally {
            this.saving = false;
            if (this.pending.size > 0) {
                this.scheduleSave();
            }
        }
    }

    apply(result, batch) {
        for (const [id, version] of Object.entries(result.saved || {})) {
            const row = this.byId.get(id);
            if (row) {
                row.version = version;
                const sent = batch.get(id);
                for (const edit of Object.values(sent.edits)) {
                    if (edit.value === null) {
                        delete row.edits[edit.field];
                    } else {
                        row.edits[edit.field] = edit;
                    }
                }
            }
        }
        for (const current of result.conflicts || []) {
            const row = this.prepare({ ...current });
            this.pending.delete(row.id);
            this.byId.set(row.id, row);
            this.rows = this.rows.map((r) => (r.id === row.id ? row : r));
            this.addMessage(
                `${row.device_tag || row.device_oid}: changed by someone else in the meantime. ` +
                    "Their version is shown; your change was not saved."
            );
        }
        for (const [id, message] of Object.entries(result.errors || {})) {
            const row = this.byId.get(id);
            this.addMessage(`${row ? row.device_tag || row.device_oid : id}: ${message}`);
        }
    }

    addMessage(text) {
        this.messages = [...this.messages, { id: `${Date.now()}-${this.messages.length}`, text }];
    }

    handleDismiss() {
        this.messages = [];
    }

    handleClearFilters() {
        this.template.querySelector("c-diba-grid").clearFilters();
    }
}

function reduceError(error) {
    if (!error) return "unknown error";
    if (error.body && error.body.message) return error.body.message;
    if (error.message) return error.message;
    return String(error);
}
