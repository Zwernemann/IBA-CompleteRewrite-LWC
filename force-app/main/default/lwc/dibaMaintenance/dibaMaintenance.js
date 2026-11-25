import { LightningElement, api } from "lwc";
import saveRows from "@salesforce/apex/DibaAccountController.saveRows";
import getIntervals from "@salesforce/apex/DibaIntervalController.getIntervals";
import lookupOrderCode from "@salesforce/apex/DibaAccountController.lookupOrderCode";
import { loadRows } from "c/dibaRowStore";
import { columnsFor } from "c/dibaColumns";
import { intervalValues } from "c/dibaReportXml";
import { translator } from "c/dibaReportState";
import { loadTranslations, userLanguage } from "c/dibaTexts";
import {
    CONSULTANT_FIELDS,
    MASTER_FIELDS,
    checkValue,
    editFor,
    prepareRow,
    refreshCalculated
} from "c/dibaRowLogic";

const SAVE_DELAY = 800;
const SAVE_BATCH = 500;

/**
 * The table dialogs of an account (ibaMaintDialog, ibaBreakdownDialog, ibaMigrationDialog,
 * ibaPreventativeDialog of IBA-Salesforce): all rows, with the columns of the dialog
 * (c/dibaColumns). Master data is editable beside the Salesforce values, consultant input
 * directly; saved as the consultant types. Rows someone else saved in the meantime are not
 * overwritten: they are reloaded and named.
 */
export default class DibaMaintenance extends LightningElement {
    @api accountDataId;
    @api height = 560;
    /** maintenance, breakdown, migration or preventative */
    @api view = "maintenance";

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

    columns = [];

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
        try {
            const [translations, rows] = await Promise.all([
                loadTranslations(),
                loadRows(this.accountDataId, (count) => {
                    this.loaded = count;
                })
            ]);
            this.columns = columnsFor(this.view, translator(translations, userLanguage()));
            if (this.view === "preventative") {
                const table = await getIntervals({ accountDataId: this.accountDataId });
                this.applyIntervals(rows, table.rows);
            }
            this.rows = rows.slice();
            this.byId = new Map(rows.map((row) => [row.id, row]));
            this.shown = rows.length;
        } catch (e) {
            this.error = reduceError(e);
        } finally {
            this.loading = false;
        }
    }

    /** The calculated intervals from the interval table of the account (not stored). */
    applyIntervals(rows, intervals) {
        this.intervalsBySpk = new Map(intervals.filter((i) => i.spk).map((i) => [i.spk, i]));
        for (const row of rows) {
            this.refreshIntervals(row);
        }
    }

    refreshIntervals(row) {
        if (!this.intervalsBySpk) return;
        const values = row.devicetype_spk ? intervalValues(row, this.intervalsBySpk.get(row.devicetype_spk)) : null;
        row.device_insp_interval = values ? values.insp : "-";
        row.device_calib_interval = values ? values.calib : "-";
        row.device_valid_interval = values ? values.valid : "-";
    }

    /**
     * Applies the edits and calculates risk and obsolescence. The calculation is shown and
     * goes into the report; it is stored only with the next change of the row, so that
     * opening a large account does not write all its rows.
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
        this.refreshIntervals(row);
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
                if (sent.edits.device_ordercode) {
                    this.lookUpSuccessor(row);
                }
            }
        }
        for (const current of result.conflicts || []) {
            // The shared row object takes the stored state, so the account view sees it too.
            const row = this.byId.get(current.id);
            if (!row) continue;
            for (const key of Object.keys(row)) delete row[key];
            Object.assign(row, this.prepare({ ...current }));
            this.pending.delete(row.id);
            this.rows = [...this.rows];
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

    /**
     * A changed order code gets its successor from the Order Code Transformer at once, as
     * before; the server stores it and the row takes what is stored.
     */
    async lookUpSuccessor(row) {
        try {
            const current = await lookupOrderCode({ rowId: row.id });
            if (this.pending.has(row.id)) {
                // Newer changes of the row go with the next save; only take the successor.
                row.add_ordercode_transform = current.add_ordercode_transform;
                row.add_recomend_ordercode = current.add_recomend_ordercode;
                row.version = current.version;
            } else {
                for (const key of Object.keys(row)) delete row[key];
                Object.assign(row, this.prepare({ ...current }));
            }
            this.rows = [...this.rows];
        } catch (e) {
            this.addMessage(`${row.device_tag || row.device_oid}: ${reduceError(e)}`);
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
