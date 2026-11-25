/**
 * What the grid computes, without the DOM: shown values, filtering, sorting and the window
 * of rows that is actually rendered. Kept apart so that it can be measured and tested with
 * large tables.
 *
 * A column: { field, label, width, type, options, editable(row) }
 *   type     text (default), date, number, select, checkbox
 *   options  for select: [{ value, label }]; the filter of the column offers the same
 */

/** The value of a cell as shown, a string. */
export function displayValue(column, row) {
    const value = row[column.field];
    if (value === undefined || value === null) {
        return "";
    }
    if (column.type === "checkbox") {
        return value === true || value === "true" ? "Yes" : "No";
    }
    if (column.type === "select" && column.options) {
        const option = column.options.find((o) => String(o.value) === String(value));
        return option ? option.label : String(value);
    }
    return String(value);
}

/** The value a select filter compares: the stored value as text, empty for none. */
function filterKey(column, row) {
    const value = row[column.field];
    if (column.type === "checkbox") {
        return value === true || value === "true" ? "true" : "false";
    }
    return value === undefined || value === null ? "" : String(value);
}

/**
 * The rows that pass all filters. filters maps a field to its filter: text columns match
 * when the shown value contains the text (case does not matter); select and checkbox
 * columns when the value equals the chosen one.
 */
export function filterRows(rows, columns, filters) {
    const active = columns
        .filter((column) => filters[column.field] !== undefined && filters[column.field] !== "")
        .map((column) => {
            const filter = filters[column.field];
            if (column.type === "select" || column.type === "checkbox") {
                return (row) => filterKey(column, row) === filter;
            }
            const needle = String(filter).toLowerCase();
            return (row) => displayValue(column, row).toLowerCase().includes(needle);
        });
    if (active.length === 0) {
        return rows;
    }
    return rows.filter((row) => active.every((test) => test(row)));
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Rows sorted by a column, stable; empty values last in both directions. Returns a new
 * array, the rows themselves stay.
 */
export function sortRows(rows, column, direction) {
    if (!column) {
        return rows;
    }
    const sign = direction === "desc" ? -1 : 1;
    const keyed = rows.map((row, index) => ({ row, index, key: displayValue(column, row) }));
    keyed.sort((a, b) => {
        if (a.key === "" && b.key !== "") return 1;
        if (b.key === "" && a.key !== "") return -1;
        const order = collator.compare(a.key, b.key) * sign;
        return order !== 0 ? order : a.index - b.index;
    });
    return keyed.map((entry) => entry.row);
}

/**
 * The rows to render for a scroll position: from start to end (exclusive), with the
 * heights of the empty space above and below, so the scroll bar stays that of the whole
 * table.
 */
export function windowOf(total, scrollTop, viewportHeight, rowHeight, overscan = 10) {
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visible = Math.ceil(viewportHeight / rowHeight) + 2 * overscan;
    const start = Math.min(first, Math.max(0, total - 1));
    const end = Math.min(total, start + visible);
    return {
        start,
        end,
        top: start * rowHeight,
        bottom: Math.max(0, (total - end) * rowHeight)
    };
}
