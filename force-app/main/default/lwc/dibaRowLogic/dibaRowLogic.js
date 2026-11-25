/**
 * Rules of a row of the account table, ported from IBA-Salesforce:
 * MasterField (edits of master data beside the Salesforce values) and
 * IbaDeviceTools.refreshRiskOfMaintenance (risk of maintenance and obsolescence).
 *
 * Rows come from DibaAccountController.getRows with the element names of the report XML as
 * keys. prepareRow keeps the Salesforce values under row.sf and puts the edits that still
 * apply into the row itself, so that the table shows and the report gets the effective
 * values.
 */

/** Master fields the consultant may change, with how their value is held as text. */
export const MASTER_FIELDS = {
    device_tag: { label: "Tag", maxLength: 255, kind: "text" },
    device_ordercode: { label: "Order code", maxLength: 255, kind: "text" },
    device_serialnumber: { label: "Serial number", maxLength: 255, kind: "text" },
    device_shortname: { label: "Product name", maxLength: 255, kind: "text" },
    devicetype_spk: { label: "SPK", maxLength: 32, kind: "text" },
    device_manufacturingdate: { label: "Manufacturing date", maxLength: 10, kind: "date" },
    device_criticality: { label: "Criticality", maxLength: 32, kind: "text" },
    device_conditions: { label: "Conditions", maxLength: 32, kind: "text" },
    device_specialdemands: { label: "Special demands", maxLength: 0, kind: "specialDemands" },
    device_accessibility: { label: "Accessibility", maxLength: 32, kind: "text" },
    device_maint_effectivness: { label: "Maintenance effectiveness", maxLength: 32, kind: "text" },
    device_activities: { label: "Activities", maxLength: 255, kind: "text" },
    device_property_envrelevant: { label: "Environment relevant", maxLength: 0, kind: "boolean" },
    device_property_safetyrelevant: { label: "Safety relevant", maxLength: 0, kind: "boolean" },
    device_property_qualityrelevant: { label: "Quality relevant", maxLength: 0, kind: "boolean" }
};

/** Consultant fields, written directly. */
export const CONSULTANT_FIELDS = {
    add_ordercode_transform: { maxLength: 255 },
    add_recomend_ordercode: { maxLength: 255 },
    add_amount_spare: { maxLength: 255 },
    add_remark1: { maxLength: 32768 },
    add_remark2: { maxLength: 32768 },
    add_remark3: { maxLength: 32768 },
    add_nu_price: { maxLength: 0 },
    reco_insp_interval: { maxLength: 32 },
    reco_calib_interval: { maxLength: 32 },
    reco_valid_interval: { maxLength: 32 }
};

export const CALCULATED_FIELDS = ["device_riskofmaint", "device_obsolence"];

function emptyAsNull(value) {
    return value === undefined || value === null || value === "" ? null : value;
}

/**
 * The value of a master field as text, the form edits are stored in: dates as YYYY-MM-DD,
 * switches as true/false, special demands as 1/0.
 */
export function toText(field, value) {
    const kind = MASTER_FIELDS[field] ? MASTER_FIELDS[field].kind : "text";
    if (value === undefined || value === null) {
        return kind === "boolean" ? "false" : kind === "specialDemands" ? "0" : null;
    }
    if (kind === "boolean") {
        return value === true || value === "true" ? "true" : "false";
    }
    if (kind === "specialDemands") {
        return value === true || value === 1 || value === "1" ? "1" : "0";
    }
    return String(value);
}

/** The text of an edit back in the form of the row. */
export function fromText(field, text) {
    const kind = MASTER_FIELDS[field] ? MASTER_FIELDS[field].kind : "text";
    if (kind === "boolean") {
        return text === "true";
    }
    if (kind === "specialDemands") {
        return text === "1";
    }
    return text === undefined ? null : text;
}

/** Whether an edit made on salesforceValue still applies to the current Salesforce value. */
export function editApplies(edit, currentText) {
    return emptyAsNull(edit.salesforceValue) === emptyAsNull(currentText);
}

export function isEndressHauser(row) {
    return (row.supplier_name || "").toLowerCase() === "endress+hauser";
}

/**
 * Prepares a row from the server: Salesforce values under sf, applying edits in the row,
 * the edits by field under edits. Returns the same object.
 */
export function prepareRow(row) {
    row.sf = {};
    for (const field of Object.keys(MASTER_FIELDS)) {
        row.sf[field] = row[field] === undefined ? null : row[field];
    }
    const edits = {};
    for (const edit of row.edits || []) {
        edits[edit.field] = edit;
        if (editApplies(edit, toText(edit.field, row.sf[edit.field]))) {
            row[edit.field] = fromText(edit.field, edit.value);
        }
    }
    row.edits = edits;
    return row;
}

/**
 * The objection to a value in words, or null if it can be stored. As MasterField.check:
 * a date of the form 2019-03-01, and the length.
 */
export function checkValue(field, value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const master = MASTER_FIELDS[field];
    const text = String(value);
    if (master && master.kind === "date" && !isIsoDate(text)) {
        return `${master.label}: "${text}" is not a date of the form 2019-03-01.`;
    }
    const maxLength = master ? master.maxLength : (CONSULTANT_FIELDS[field] || {}).maxLength;
    if (maxLength > 0 && text.length > maxLength) {
        const label = master ? master.label : field;
        return `${label} is limited to ${maxLength} characters, the entry has ${text.length}.`;
    }
    if (field === "add_nu_price" && Number.isNaN(Number(text))) {
        return `Price: "${text}" is not a number.`;
    }
    return null;
}

function isIsoDate(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) {
        return false;
    }
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * The edit to store when the consultant sets a master field to value: removed (value
 * null) when it equals the Salesforce value again.
 */
export function editFor(row, field, value) {
    const sfText = toText(field, row.sf ? row.sf[field] : null);
    const text = toText(field, value);
    if (emptyAsNull(text) === emptyAsNull(sfText)) {
        return { field, value: null, salesforceValue: sfText };
    }
    return { field, value: text === null ? "" : text, salesforceValue: sfText };
}

/** The date of an ISO date such as "2019-03-01", or null; as IbaDeviceTools.manufacturingDate. */
function manufacturingDate(text) {
    if (!text || text.length < 10) {
        return null;
    }
    const value = text.substring(0, 10);
    return isIsoDate(value) ? value : null;
}

function dayOfYear(date) {
    return Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
}

/**
 * The age in years as the inherited code counted it: the date is moved back by the days
 * that have passed in the year of today, then the calendar years are compared
 * (IbaDeviceTools.yearsBetween).
 */
export function yearsBetween(today, isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const moved = new Date(Date.UTC(year, month - 1, day) + (1 - dayOfYear(today)) * 86400000);
    return moved.getUTCFullYear() - today.getUTCFullYear();
}

/**
 * Risk of maintenance and obsolescence, exactly as IbaDeviceTools.refreshRiskOfMaintenance,
 * including its order of the conditions. Returns whether a value changed.
 */
export function refreshCalculated(row, today = new Date()) {
    let obsolescence = "notset";
    if (row.supplier_name !== null && row.supplier_name !== undefined) {
        if (row.supplier_name !== "Endress+Hauser") {
            const manufactured = manufacturingDate(row.device_manufacturingdate);
            if (manufactured !== null) {
                const age = Math.abs(yearsBetween(today, manufactured));
                obsolescence = age >= 15 ? "high" : age >= 7 ? "medium" : "low";
            }
        } else {
            const status = (row.device_productstatus || "").toLowerCase();
            if (status === "available") {
                obsolescence = "low";
            }
            if (status === "phase out") {
                obsolescence = "medium";
            }
            if (status === "order stop") {
                obsolescence = "high";
            }
        }
    }

    const status = row.device_accessibility || "";
    const maintenance = row.device_maint_effectivness || "";
    let risk = "notset";
    if (maintenance !== "" && status !== "") {
        if (maintenance === "low" || status === "easy") {
            risk = "low";
        }
        if (maintenance === "medium" || status === "moderate") {
            risk = "normal";
        }
        if (maintenance === "high" || status === "difficult") {
            risk = "high";
        }
    }

    let changed = false;
    if (risk !== row.device_riskofmaint) {
        row.device_riskofmaint = risk;
        changed = true;
    }
    if (obsolescence !== row.device_obsolence) {
        row.device_obsolence = obsolescence;
        changed = true;
    }
    return changed;
}
