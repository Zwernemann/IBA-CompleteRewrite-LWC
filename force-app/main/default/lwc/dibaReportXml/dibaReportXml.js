/**
 * The report XML for the CRGenerator, built in the browser. It has to be the XML that
 * IBA-Salesforce writes with JAXB from IbaXmlLayout, character for character: that XML is
 * the contract with the 51 Crystal templates. The tests compare against reference files
 * written by the Java code itself (test/reportxml).
 *
 * Ported from IBA-Salesforce:
 *   DeviceDataMapper, ReportXmlFields     device fields, surrogate numbers, intervals
 *   IbaDeviceTools.refreshSliderPercentages  the two calculated sliders
 *   IbaSiteValues.convertImplementationTimeline  (Jsoup) the cells of the timeline
 *   JAXB, formatted output                element order, indentation, escaping
 *   FineTuneWriter                        <br /> and list bullets for Crystal
 *
 * Plain arrays and strings only: typed arrays are many times slower inside Lightning Web
 * Security, and a plant can have 50,000 rows.
 */

// --- Element order of the JAXB classes ---------------------------------------------------

const DEVICE = [
    ["site_oid", "number"],
    ["device_oid", "number"],
    ["supplier_oid", "number"],
    ["location_oid", "number"],
    ["devicetype_oid", "number"],
    ["api_instrumentation_id", "number"],
    ["api_asset_id", "number"],
    ["api_product_id", "number"],
    ["site_name"],
    ["supplier_name"],
    ["location_name"],
    ["device_shortname"],
    ["device_criticality"],
    ["device_accessibility"],
    ["device_ordercode"],
    ["device_riskofmaint"],
    ["device_serialnumber"],
    ["device_measuringtask"],
    ["device_tag"],
    ["device_manufacturingdate"],
    ["device_conditions"],
    ["device_specialdemands", "number"],
    ["devicetype_spk"],
    ["devicetype_label_lang"],
    ["devicetype_label_description"],
    ["device_property_envrelevant", "boolean"],
    ["device_property_safetyrelevant", "boolean"],
    ["device_property_qualityrelevant", "boolean"],
    ["device_activities"],
    ["device_maint_effectivness"],
    ["psl_status"],
    ["device_obsolence"],
    ["device_assettype"],
    ["add_ordercode_transform"],
    ["add_recomend_ordercode"],
    ["add_amount_spare"],
    ["add_remark1"],
    ["add_remark2"],
    ["add_remark3"],
    ["add_nu_price", "float"],
    ["reco_insp_interval"],
    ["reco_calib_interval"],
    ["reco_valid_interval"],
    ["device_insp_interval"],
    ["device_calib_interval"],
    ["device_valid_interval"],
    ["out_device_riskofmaint"],
    ["out_device_obsolence"],
    ["out_device_conditions"],
    ["psl_npw", "date"],
    ["psl_pcstop", "date"],
    ["psl_sparesuntil", "date"]
];

export const INTERVAL_COLUMNS = [];
for (const kind of ["insp", "calib", "valid"]) {
    for (const criticality of ["high", "medium", "low"]) {
        for (const conditions of ["normal", "heavy"]) {
            INTERVAL_COLUMNS.push(`${criticality}_${conditions}_${kind}`);
        }
    }
}

const INTERVAL = [["spk"], ["assettype"], ...INTERVAL_COLUMNS.map((c) => [c]), ["id", "number"]];

const PAGEBREAKS = [
    "overview_situation",
    "overview_reason",
    "overview_milestones",
    "overview_impression",
    "overview_matrix",
    "overview_standardisation",
    "overview_maintenance",
    "overview_migration",
    "overview_preventative",
    "overview_action",
    "overview_attachment",
    "standardisation_situation",
    "standardisation_attachment",
    "breakdown_high_criticality",
    "breakdown_medium_criticality",
    "breakdown_situation",
    "breakdown_attachment",
    "migration_situation_all",
    "migration_situation_eh",
    "migration_situation_others",
    "migration_recommendations",
    "preventative_situation",
    "preventative_recommendations",
    "implementation_comment"
];

/** The 24 report texts with a page break switch, in the order of IbaSiteValues. */
export const REPORT_TEXTS = PAGEBREAKS;

const SITEVALUE = [
    ["jobId"],
    ["siteName"],
    ["lastAssetCount", "int"],
    ["sliderManufacturers", "int"],
    ["sliderStandardisation", "int"],
    ["sliderMaintainability", "int"],
    ["sliderMaintainabilityCalculated", "int"],
    ["sliderMaintenance", "int"],
    ["sliderProcessCriticality", "int"],
    ...PAGEBREAKS.map((name) => [`${name}_pagebreak`, "boolean"]),
    ...PAGEBREAKS.map((name) => [name]),
    ["implementation_timeline"],
    ["implementation_timeline_converted"],
    ["implementation_head1"],
    ["implementation_head2"],
    ["implementation_head3"],
    ["maintenance_spks"]
];

const USER = [
    ["u_userid", "number"],
    ["u_loginprintname"],
    ["u_reportlanguage"],
    ["u_reportaddress"],
    ["lastEntry", "Boolean"],
    ["isAdmin", "Boolean"],
    ["u_frontend_language"],
    ["u_loginname"],
    ["hub_email"],
    ["hub_first_name"],
    ["hub_last_name"]
];

const REPORTSETTINGS = [
    ["jobId"],
    ["reportLanguage"],
    ["asianVariant"],
    ["showHeader", "boolean"],
    ["exportFormat"],
    ["contactDetails"],
    ["userName"],
    ["finalVersion"],
    ["hideBudgetPrice", "boolean"]
];

// --- Device fields (DeviceDataMapper, ReportXmlFields) -----------------------------------

/** location_oid of a device without location, as in the predecessor. */
export const NO_LOCATION = 888888888;
/** device_assettype without a row in the interval table. */
export const NO_ASSET_TYPE = "not defined";

const text = (value) => (value === undefined || value === null ? "" : String(value));
const trimmed = (value) => text(value).trim();

/**
 * The devices of the report from the rows of the table (prepared by c/dibaRowLogic, so
 * with the master data edits applied and risk and obsolescence calculated).
 *
 * @param rows       rows as DibaPlantController.getRows delivers them
 * @param options    { accountId, siteName, intervals }; intervals as in the XML (spk,
 *                   assettype, the 18 columns, id)
 */
export function devicesOf(rows, { accountId, siteName, intervals }) {
    const bySpk = new Map();
    for (const interval of intervals || []) {
        if (interval.spk && !bySpk.has(interval.spk)) {
            bySpk.set(interval.spk, interval);
        }
    }
    const site = accountId ? surrogate(`account:${accountId}`) : null;
    const devices = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
        devices[i] = deviceOf(rows[i], site, siteName, bySpk);
    }
    return devices;
}

function deviceOf(row, site, siteName, bySpk) {
    const d = {
        site_oid: site,
        device_oid: Number(row.device_oid),
        api_instrumentation_id: row.tag_id ? surrogate(`tag:${row.tag_id}`) : null,
        api_asset_id: row.asset_id ? surrogate(`asset:${row.asset_id}`) : null,
        site_name: siteName === undefined || siteName === null ? "" : siteName,
        supplier_name: text(row.supplier_name),
        location_name: text(row.location_name),
        device_shortname: text(row.device_shortname),
        device_criticality: text(row.device_criticality),
        device_accessibility: text(row.device_accessibility),
        device_ordercode: text(row.device_ordercode),
        device_riskofmaint: text(row.device_riskofmaint),
        device_serialnumber: text(row.device_serialnumber),
        device_measuringtask: text(row.device_measuringtask),
        device_tag: text(row.device_tag),
        device_manufacturingdate: text(row.device_manufacturingdate),
        device_conditions: text(row.device_conditions),
        device_specialdemands: row.device_specialdemands === true ? 1 : 0,
        devicetype_spk: text(row.devicetype_spk),
        devicetype_label_lang: "",
        devicetype_label_description: text(row.devicetype_label_description),
        device_property_envrelevant: row.device_property_envrelevant === true,
        device_property_safetyrelevant: row.device_property_safetyrelevant === true,
        device_property_qualityrelevant: row.device_property_qualityrelevant === true,
        device_activities: text(row.device_activities),
        device_maint_effectivness: text(row.device_maint_effectivness),
        psl_status: text(row.device_productstatus),
        device_obsolence: text(row.device_obsolence),
        add_ordercode_transform: text(row.add_ordercode_transform),
        add_recomend_ordercode: text(row.add_recomend_ordercode),
        add_amount_spare: text(row.add_amount_spare),
        add_remark1: text(row.add_remark1),
        add_remark2: text(row.add_remark2),
        add_remark3: text(row.add_remark3),
        add_nu_price: row.add_nu_price === undefined || row.add_nu_price === null ? 0 : Number(row.add_nu_price),
        reco_insp_interval: text(row.reco_insp_interval),
        reco_calib_interval: text(row.reco_calib_interval),
        reco_valid_interval: text(row.reco_valid_interval),
        device_insp_interval: text(row.device_insp_interval),
        device_calib_interval: text(row.device_calib_interval),
        device_valid_interval: text(row.device_valid_interval),
        out_device_conditions: ""
    };

    // ReportXmlFields.complete
    d.supplier_oid = surrogate(`supplier:${trimmed(d.supplier_name)}`);
    const location = trimmed(d.location_name);
    d.location_oid = location === "" ? NO_LOCATION : surrogate(`location:${location}`);
    const code = trimmed(d.device_ordercode);
    d.api_product_id = code === "" ? null : surrogate(`product:${code}`);
    const spk = trimmed(d.devicetype_spk);
    const type = bySpk.get(spk);
    d.devicetype_oid = !type || type.id === undefined || type.id === null ? 0 : Number(type.id);
    d.device_assettype = !type || trimmed(type.assettype) === "" ? NO_ASSET_TYPE : type.assettype;
    if (spk !== "" || trimmed(d.devicetype_label_description) !== "") {
        d.devicetype_label_lang = "en";
    }
    productStatusDates(d);
    // IbaDeviceTools looks the SPK up as it is, without trimming.
    intervalsOf(d, d.devicetype_spk === spk ? type : bySpk.get(d.devicetype_spk));
    return d;
}

function productStatusDates(d) {
    const status = trimmed(d.psl_status).toLowerCase();
    let phaseOut = "9999-12-31";
    let orderStop = "9999-12-31";
    if (status === "available") {
        phaseOut = "3000-01-01";
        orderStop = "3000-01-01";
    } else if (status === "phase out") {
        phaseOut = "1990-01-01";
        orderStop = "2100-01-01";
    } else if (status === "order stop") {
        phaseOut = "1990-01-01";
        orderStop = "1990-01-01";
    }
    d.psl_npw = phaseOut;
    d.psl_pcstop = orderStop;
    d.psl_sparesuntil = "3000-01-01";
}

const unset = (value) => value === undefined || value === null || value === "" || value === "-";

/** IbaDeviceTools.refreshCalibrationSingleInterval, then the "-" of recommendedIntervals. */
function intervalsOf(d, type) {
    if (d.devicetype_spk !== "" && type) {
        const column = (kind) => {
            const name = `${d.device_criticality.toLowerCase()}_${d.device_conditions.toLowerCase()}_${kind}`;
            return INTERVAL_COLUMNS.includes(name) ? text(type[name]) : "-";
        };
        const insp = column("insp");
        const calib = column("calib");
        const valid = column("valid");
        if (unset(d.reco_calib_interval)) d.reco_calib_interval = calib;
        if (unset(d.reco_insp_interval)) d.reco_insp_interval = insp;
        if (unset(d.reco_valid_interval)) d.reco_valid_interval = valid;
        d.device_calib_interval = calib;
        d.device_insp_interval = insp;
        d.device_valid_interval = valid;
    }
    for (const name of [
        "reco_insp_interval",
        "reco_calib_interval",
        "reco_valid_interval",
        "device_insp_interval",
        "device_calib_interval",
        "device_valid_interval"
    ]) {
        if (trimmed(d[name]) === "") {
            d[name] = "-";
        }
    }
}

/**
 * The two sliders the application calculates, as IbaDeviceTools.refreshSliderPercentages:
 * process criticality and maintainability in percent, truncated.
 */
export function sliderPercentages(rows) {
    let maintLow = 0;
    let maintNormal = 0;
    let maintHigh = 0;
    let critLow = 0;
    let critNormal = 0;
    let critHigh = 0;
    for (const row of rows) {
        const criticality = text(row.device_criticality).toLowerCase();
        const risk = text(row.device_riskofmaint).toLowerCase();
        if (criticality === "medium" || criticality === "normal" || criticality === "high") {
            if (risk === "high") maintHigh++;
            if (risk === "normal") maintNormal++;
            if (risk === "low") maintLow++;
        }
        if (risk === "normal" || risk === "high") {
            if (criticality === "high") critHigh++;
            if (criticality === "medium" || criticality === "normal") critNormal++;
            if (criticality === "low") critLow++;
        }
    }
    let maintenance = 0;
    let criticality = 0;
    if (maintLow + maintNormal + maintHigh > 0) {
        const calc = (maintLow + 2 * maintNormal + 3 * maintHigh) / (maintLow + maintNormal + maintHigh);
        maintenance = ((calc - 1) * 100) / 2;
    }
    if (critLow + critNormal + critHigh > 0) {
        const calc = (critLow + 2 * critNormal + 3 * critHigh) / (critLow + critNormal + critHigh);
        criticality = ((calc - 1) * 100) / 2;
    }
    return { maintainability: Math.trunc(maintenance), processCriticality: Math.trunc(criticality) };
}

// --- XML (JAXB, formatted output) ----------------------------------------------------------

/** Text content as JAXB escapes it: &, < and >, nothing else. */
export function escapeXml(value) {
    let result = "";
    let start = 0;
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        let entity = null;
        if (c === 38) entity = "&amp;";
        else if (c === 60) entity = "&lt;";
        else if (c === 62) entity = "&gt;";
        if (entity) {
            result += value.substring(start, i) + entity;
            start = i + 1;
        }
    }
    return start === 0 ? value : result + value.substring(start);
}

function format(value, type) {
    switch (type) {
        case "boolean":
        case "Boolean":
            return value ? "true" : "false";
        case "float":
            return javaFloat(value);
        case "date":
            return `${value}T00:00:00Z`;
        case "int":
        case "number":
            return String(Math.trunc(Number(value)));
        default:
            return escapeXml(String(value));
    }
}

function writeObject(out, indent, name, object, fields) {
    out.push(`${indent}<${name}>`);
    const inner = indent + "    ";
    for (const [field, type] of fields) {
        let value = object[field];
        if (value === undefined || value === null) {
            // A primitive in Java is always written; an object (Boolean, Integer, String)
            // only when set.
            if (type === "boolean") value = false;
            else if (type === "int") value = 0;
            else continue;
        }
        out.push(`${inner}<${field}>${format(value, type)}</${field}>`);
    }
    out.push(`${indent}</${name}>`);
}

/**
 * The XML as JAXB writes IbaXmlLayout with formatted output.
 *
 * @param layout { devices, sitevalue, user, intervals, reportsettings }; the device objects
 *               from devicesOf, the others with the element names as keys
 */
export function writeXml(layout) {
    const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', "<ibadata>"];
    if (layout.devices) {
        out.push("    <devices>");
        for (const device of layout.devices) {
            writeObject(out, "        ", "device", device, DEVICE);
        }
        out.push("    </devices>");
    }
    if (layout.sitevalue) {
        const site = { ...layout.sitevalue };
        site.implementation_timeline_converted = convertTimeline(site.implementation_timeline);
        writeObject(out, "    ", "sitevalue", site, SITEVALUE);
    }
    if (layout.user) {
        writeObject(out, "    ", "user", layout.user, USER);
    }
    if (layout.intervals) {
        out.push("    <intervals>");
        for (const interval of layout.intervals) {
            writeObject(out, "        ", "asset", interval, INTERVAL);
        }
        out.push("    </intervals>");
    }
    if (layout.reportsettings) {
        writeObject(out, "    ", "reportsettings", layout.reportsettings, REPORTSETTINGS);
    }
    out.push("</ibadata>");
    return out.join("\n") + "\n";
}

// --- FineTuneWriter --------------------------------------------------------------------------

const BREAK = "&lt;br /&gt;";
const BREAK_NEW = "&lt;br&gt;";
const ITEM = "&lt;li&gt;";
const ITEM_NEW = '&lt;li&gt;&lt;span style="font-family: Symbol;"&gt;·&lt;/span&gt;&#xA0;&#xA0;';

/** What the CRGenerator gets: <br /> as <br>, and a bullet in front of every list item. */
export function fineTune(xml) {
    return xml.split(BREAK).join(BREAK_NEW).split(ITEM).join(ITEM_NEW);
}

/** The whole XML the CRGenerator gets. */
export function reportXml(layout) {
    return fineTune(writeXml(layout));
}

// --- Java Float.toString --------------------------------------------------------------------

/** A number as Java writes a float: the shortest digits that give the same float. */
export function javaFloat(value) {
    const f = Math.fround(Number(value));
    if (Number.isNaN(f)) return "NaN";
    if (f === Infinity) return "Infinity";
    if (f === -Infinity) return "-Infinity";
    if (f === 0) return Object.is(f, -0) ? "-0.0" : "0.0";
    let digits = 1;
    let shortest = f.toPrecision(digits);
    while (Math.fround(Number(shortest)) !== f && digits < 9) {
        digits++;
        shortest = f.toPrecision(digits);
    }
    const number = Number(shortest);
    const abs = Math.abs(number);
    if (abs >= 1e-3 && abs < 1e7) {
        let plain = String(number);
        if (plain.includes("e")) {
            plain = number.toFixed(20).replace(/0+$/, "");
        }
        return plain.includes(".") ? plain : `${plain}.0`;
    }
    const [mantissa, exponent] = number.toExponential().split("e");
    const m = mantissa.includes(".") ? mantissa : `${mantissa}.0`;
    return `${m}E${Number(exponent)}`;
}

// --- SHA-256 surrogate numbers -----------------------------------------------------------------

const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function utf8(value) {
    const bytes = [];
    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        if (c >= 0xd800 && c < 0xdc00 && i + 1 < value.length) {
            const low = value.charCodeAt(i + 1);
            if (low >= 0xdc00 && low < 0xe000) {
                c = 0x10000 + ((c - 0xd800) << 10) + (low - 0xdc00);
                i++;
            }
        } else if (c >= 0xd800 && c < 0xe000) {
            c = 0x3f; // a lone surrogate, as Java's encoder writes it: "?"
        }
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return bytes;
}

/** The first two words of the SHA-256 of a byte list (48 bits are taken from them). */
function sha256Head(bytes) {
    const length = bytes.length;
    const message = bytes.slice();
    message.push(0x80);
    while (message.length % 64 !== 56) message.push(0);
    const bits = length * 8;
    const high = Math.floor(bits / 0x100000000);
    message.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255);
    message.push((bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const w = new Array(64);
    for (let offset = 0; offset < message.length; offset += 64) {
        for (let t = 0; t < 16; t++) {
            const j = offset + t * 4;
            w[t] = ((message[j] << 24) | (message[j + 1] << 16) | (message[j + 2] << 8) | message[j + 3]) | 0;
        }
        for (let t = 16; t < 64; t++) {
            const a = w[t - 15];
            const b = w[t - 2];
            const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
            const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
            w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
        }
        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;
        let f = h5;
        let g = h6;
        let h = h7;
        for (let t = 0; t < 64; t++) {
            const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + s1 + ch + K[t] + w[t]) | 0;
            const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (s0 + maj) | 0;
            h = g;
            g = f;
            f = e;
            e = (d + temp1) | 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) | 0;
        }
        h0 = (h0 + a) | 0;
        h1 = (h1 + b) | 0;
        h2 = (h2 + c) | 0;
        h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0;
        h5 = (h5 + f) | 0;
        h6 = (h6 + g) | 0;
        h7 = (h7 + h) | 0;
    }
    return [h0 >>> 0, h1 >>> 0];
}

const surrogates = new Map();

/**
 * A number for a text, the same in every report: 48 bits of its SHA-256
 * (ReportXmlFields.surrogate). Fits exactly into a JavaScript number.
 */
export function surrogate(value) {
    let result = surrogates.get(value);
    if (result === undefined) {
        const [first, second] = sha256Head(utf8(value));
        result = first * 65536 + (second >>> 16);
        if (result === 0) result = 1;
        if (surrogates.size > 200000) surrogates.clear();
        surrogates.set(value, result);
    }
    return result;
}

// --- Timeline (Jsoup) ---------------------------------------------------------------------------

/** Tags Jsoup lays out as blocks with their content on lines of its own. */
const FORMAT_AS_BLOCK = new Set([
    "html", "body", "div", "ul", "ol", "dl", "table", "thead", "tbody", "tfoot", "tr", "form",
    "fieldset", "section", "article", "aside", "header", "footer", "nav", "main", "blockquote",
    "figure", "hr", "noscript", "dd", "dt", "hgroup", "details", "menu", "center", "frameset"
]);

/** Tags on a line of their own whose content stays inline. */
const BLOCK_INLINE = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "address", "td", "th", "caption"]);

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "col", "area", "base", "embed", "source", "track", "wbr"]);

const ENTITIES = (() => {
    const names = (
        "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 " +
        "acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde " +
        "Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute " +
        "Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde " +
        "auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute " +
        "ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml"
    ).split(" ");
    const map = new Map();
    names.forEach((name, index) => map.set(0xa0 + index, `&${name};`));
    return map;
})();

/** Characters as Jsoup writes them with the charset ascii; quotes only in attributes. */
function escapeHtml(value, inAttribute) {
    let result = "";
    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        if (c >= 0xd800 && c < 0xdc00 && i + 1 < value.length) {
            const low = value.charCodeAt(i + 1);
            if (low >= 0xdc00 && low < 0xe000) {
                c = 0x10000 + ((c - 0xd800) << 10) + (low - 0xdc00);
                i++;
            }
        }
        if (c === 38) result += "&amp;";
        else if (c === 60) result += "&lt;";
        else if (c === 62) result += "&gt;";
        else if (c === 34 && inAttribute) result += "&quot;";
        else if (c < 0x80) result += String.fromCharCode(c);
        else if (ENTITIES.has(c)) result += ENTITIES.get(c);
        else result += `&#x${c.toString(16)};`;
    }
    return result;
}

function isBlock(node) {
    if (node.nodeType !== 1) return false;
    const name = node.nodeName.toLowerCase();
    return FORMAT_AS_BLOCK.has(name) || BLOCK_INLINE.has(name) || name === "br";
}

function openTag(element) {
    const name = element.nodeName.toLowerCase();
    let tag = `<${name}`;
    for (const attribute of Array.from(element.attributes)) {
        tag += attribute.value === "" ? ` ${attribute.name}` : ` ${attribute.name}="${escapeHtml(attribute.value, true)}"`;
    }
    return `${tag}>`;
}

/** Inline content on one line: whitespace collapsed, as Jsoup prints it. */
function inline(nodes) {
    let result = "";
    for (const node of nodes) {
        if (node.nodeType === 3) {
            result += escapeHtml(node.nodeValue.replace(/[ \t\n\r\f]+/g, " "), false);
        } else if (node.nodeType === 1) {
            const name = node.nodeName.toLowerCase();
            result += openTag(node);
            if (!VOID.has(name)) {
                result += inline(Array.from(node.childNodes)) + `</${name}>`;
            }
        }
    }
    return result;
}

/** The lines of a list of nodes at a depth: blocks on their own lines, inline runs between. */
function lines(nodes, depth, out) {
    const pad = " ".repeat(depth);
    let run = [];
    const flush = () => {
        const content = inline(run).trim();
        if (content !== "") out.push(pad + content);
        run = [];
    };
    for (const node of nodes) {
        if (!isBlock(node)) {
            run.push(node);
            continue;
        }
        flush();
        const name = node.nodeName.toLowerCase();
        if (VOID.has(name)) {
            out.push(pad + openTag(node));
        } else if (FORMAT_AS_BLOCK.has(name)) {
            out.push(pad + openTag(node));
            lines(Array.from(node.childNodes), depth + 1, out);
            out.push(`${pad}</${name}>`);
        } else {
            const children = Array.from(node.childNodes);
            if (children.some(isBlock)) {
                const inner = [];
                lines(children, depth + 1, inner);
                out.push(pad + openTag(node) + "\n" + inner.join("\n") + "\n" + pad + `</${name}>`);
            } else {
                out.push(pad + openTag(node) + inline(children).trim() + `</${name}>`);
            }
        }
    }
    flush();
}

/** cell.html() of Jsoup with pretty print: the content of a cell. */
function cellHtml(cell) {
    const out = [];
    lines(Array.from(cell.childNodes), 0, out);
    return out.join("\n");
}

/**
 * IbaSiteValues.convertImplementationTimeline: the content of all cells of the timeline
 * table, row by row, separated by "|".
 */
export function convertTimeline(html) {
    const source = html === undefined || html === null ? "null" : html;
    const doc = new DOMParser().parseFromString(
        `<html><head><title>Empty</title></head><body>${source}</body></html>`,
        "text/html"
    );
    const cells = [];
    for (const row of Array.from(doc.querySelectorAll("tr"))) {
        for (const cell of Array.from(row.querySelectorAll("td"))) {
            cells.push(cellHtml(cell));
        }
    }
    return cells.join("|");
}
