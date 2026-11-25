import { LightningElement, api, track } from "lwc";
import { displayValue, filterRows, sortRows, windowOf } from "c/dibaGridModel";

const ROW_HEIGHT = 32;
const DEFAULT_HEIGHT = 560;

/**
 * A table for large plants: only the rows in view are rendered, so 50,000 rows scroll like
 * fifty. Filter and sort per column, edit a cell by clicking it.
 *
 * Properties:
 *   columns  see c/dibaGridModel
 *   rows     the rows; replace the array to show changes
 *   keyField the field that identifies a row, default "id"
 *   height   height of the scroll area in pixels
 *
 * Events:
 *   cellchange  { key, field, value }   a cell was edited and left
 *   viewchange  { shown, total }        filtering changed the number of rows shown
 */
export default class DibaGrid extends LightningElement {
    @api keyField = "id";
    @api height = DEFAULT_HEIGHT;

    @track filters = {};
    sortField = null;
    sortDirection = "asc";
    scrollTop = 0;
    editing = null; // { key, field }

    _columns = [];
    _rows = [];
    view = [];

    @api
    get columns() {
        return this._columns;
    }
    set columns(value) {
        this._columns = value || [];
        this.recompute();
    }

    @api
    get rows() {
        return this._rows;
    }
    set rows(value) {
        this._rows = value || [];
        this.recompute();
    }

    /** Number of rows after filtering. */
    @api
    get shownCount() {
        return this.view.length;
    }

    /** Removes all filters. */
    @api
    clearFilters() {
        this.filters = {};
        this.recompute();
    }

    recompute() {
        const column = this._columns.find((c) => c.field === this.sortField);
        this.view = sortRows(filterRows(this._rows, this._columns, this.filters), column, this.sortDirection);
        const maxTop = Math.max(0, this.view.length * ROW_HEIGHT - this.height);
        if (this.scrollTop > maxTop) {
            this.scrollTop = maxTop;
        }
        this.dispatchEvent(
            new CustomEvent("viewchange", { detail: { shown: this.view.length, total: this._rows.length } })
        );
    }

    // --- rendering -------------------------------------------------------------------

    get tableWidth() {
        return this._columns.reduce((sum, column) => sum + (column.width || 120), 0);
    }

    get tableStyle() {
        return `width: ${this.tableWidth}px;`;
    }

    get scrollStyle() {
        return `height: ${this.height}px;`;
    }

    get headers() {
        return this._columns.map((column) => {
            const sorted = this.sortField === column.field;
            const isSelect = column.type === "select" || column.type === "checkbox";
            let options = [];
            if (column.type === "checkbox") {
                options = [
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" }
                ];
            } else if (isSelect) {
                options = column.options || [];
            }
            const filter = this.filters[column.field] || "";
            return {
                field: column.field,
                label: column.label,
                style: `width: ${column.width || 120}px;`,
                sortIcon: sorted ? (this.sortDirection === "asc" ? "utility:arrowup" : "utility:arrowdown") : null,
                sortLabel: sorted ? (this.sortDirection === "asc" ? "ascending" : "descending") : "not sorted",
                isSelect,
                filter,
                filterOptions: options.map((o) => ({
                    value: String(o.value),
                    label: o.label,
                    selected: String(o.value) === filter
                }))
            };
        });
    }

    get window() {
        return windowOf(this.view.length, this.scrollTop, this.height, ROW_HEIGHT);
    }

    get topSpacerStyle() {
        return `height: ${this.window.top}px;`;
    }

    get bottomSpacerStyle() {
        return `height: ${this.window.bottom}px;`;
    }

    get isEmpty() {
        return this.view.length === 0;
    }

    get visibleRows() {
        const { start, end } = this.window;
        const result = [];
        for (let index = start; index < end; index++) {
            const row = this.view[index];
            const key = String(row[this.keyField]);
            result.push({
                key,
                className: index % 2 === 0 ? "diba-row" : "diba-row diba-row_odd",
                cells: this._columns.map((column) => this.cell(column, row, key))
            });
        }
        return result;
    }

    cell(column, row, key) {
        const editable = typeof column.editable === "function" ? column.editable(row) : !!column.editable;
        const editing = editable && this.editing && this.editing.key === key && this.editing.field === column.field;
        const value = row[column.field];
        const type = column.type || "text";
        return {
            id: `${key}:${column.field}`,
            field: column.field,
            display: displayValue(column, row),
            title: displayValue(column, row),
            style: `width: ${column.width || 120}px;`,
            className: "diba-cell" + (editable ? " diba-cell_editable" : "") + (editing ? " diba-cell_editing" : ""),
            editable,
            disabled: !editable,
            editing,
            isCheckbox: type === "checkbox",
            checked: value === true || value === "true",
            isSelectEditor: editing && type === "select",
            isInputEditor: editing && type !== "select" && type !== "checkbox",
            inputType: type === "number" ? "number" : type === "date" ? "date" : "text",
            value: value === undefined || value === null ? "" : String(value),
            options: (column.options || []).map((o) => ({
                value: String(o.value),
                label: o.label,
                selected: String(o.value) === String(value === null || value === undefined ? "" : value)
            }))
        };
    }

    renderedCallback() {
        const editor = this.template.querySelector("[data-editor]");
        if (editor && !editor.dataset.focused) {
            editor.dataset.focused = "true";
            editor.focus();
        }
    }

    // --- events ----------------------------------------------------------------------

    handleScroll(event) {
        this.scrollTop = event.target.scrollTop;
    }

    handleSort(event) {
        const field = event.currentTarget.dataset.field;
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        } else {
            this.sortField = field;
            this.sortDirection = "asc";
        }
        this.recompute();
    }

    handleFilter(event) {
        const field = event.target.dataset.field;
        this.filters = { ...this.filters, [field]: event.target.value };
        this.recompute();
    }

    handleCellClick(event) {
        const { key, field, editable } = event.currentTarget.dataset;
        if (editable !== "true" || (this.editing && this.editing.key === key && this.editing.field === field)) {
            return;
        }
        this.editing = { key, field };
    }

    handleToggle(event) {
        const { key, field } = event.target.dataset;
        this.fireChange(key, field, event.target.checked);
    }

    handleEditorKey(event) {
        if (event.key === "Enter") {
            event.target.blur();
        } else if (event.key === "Escape") {
            this.editing = null;
        }
    }

    handleEditorCommit(event) {
        if (!this.editing) {
            return;
        }
        const { key, field } = this.editing;
        const value = event.target.value;
        this.editing = null;
        const row = this._rows.find((r) => String(r[this.keyField]) === key);
        const before = row ? row[field] : undefined;
        if (String(before === null || before === undefined ? "" : before) !== value) {
            this.fireChange(key, field, value);
        }
    }

    fireChange(key, field, value) {
        this.dispatchEvent(new CustomEvent("cellchange", { detail: { key, field, value } }));
    }
}
