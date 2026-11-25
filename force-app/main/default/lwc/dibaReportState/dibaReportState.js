/**
 * The report texts and report settings of an account as the page works on them, ported from
 * IBA-Salesforce: ReportTemplates (templates per report language), ReportState (what
 * changed since loading, versions per field), ReportValuesSession (templates for texts
 * never stored, texts that follow a new report language) and ReportPreset.
 *
 * Values are held as in IbaSiteValues and IbaReportSettings, by their XML element names.
 * Stored, every field is JSON text with a version (DIBA_Report_Value__c).
 */

import { REPORT_TEXTS } from "c/dibaReportXml";

export const TEXTS = "texts";
export const SETTINGS = "settings";

/** The languages of the report, as offered in the report settings. */
export const REPORT_LANGUAGES = [
    "en_US",
    "cn_CN",
    "de_DE",
    "es_ES",
    "fr_FR",
    "fi_FI",
    "it_IT",
    "nl_NL",
    "pl_PL",
    "pt_PT",
    "ru_RU",
    "se_SE"
];

/** Fields of the texts that are not stored: set on loading or calculated. */
const TEXTS_NOT_STORED = new Set([
    "jobId",
    "siteName",
    "lastAssetCount",
    "sliderProcessCriticality",
    "sliderMaintainabilityCalculated",
    "implementation_timeline_converted"
]);
const SETTINGS_NOT_STORED = new Set(["jobId"]);

const TEXT_PREFIXES = ["overview_", "standardisation_", "breakdown_", "migration_", "preventative_", "implementation_"];

/** Fields of IbaSiteValues in their order; a text field is null until filled. */
export const SITE_FIELDS = [
    "jobId",
    "siteName",
    "lastAssetCount",
    "sliderManufacturers",
    "sliderStandardisation",
    "sliderMaintainability",
    "sliderMaintainabilityCalculated",
    "sliderMaintenance",
    "sliderProcessCriticality",
    ...REPORT_TEXTS.map((name) => `${name}_pagebreak`),
    ...REPORT_TEXTS,
    "implementation_timeline",
    "implementation_timeline_converted",
    "implementation_head1",
    "implementation_head2",
    "implementation_head3",
    "maintenance_spks"
];

export const SETTING_FIELDS = [
    "jobId",
    "reportLanguage",
    "asianVariant",
    "showHeader",
    "exportFormat",
    "contactDetails",
    "userName",
    "finalVersion",
    "hideBudgetPrice"
];

/** The texts of an account before anything is loaded (IbaJobView.loadJobRecord). */
export function defaultTexts(jobId, siteName) {
    const texts = {};
    for (const field of SITE_FIELDS) {
        texts[field] = field.endsWith("_pagebreak") ? false : null;
    }
    Object.assign(texts, {
        jobId,
        siteName,
        lastAssetCount: 0,
        sliderStandardisation: 100,
        sliderMaintenance: 50,
        sliderManufacturers: 50,
        sliderProcessCriticality: 0,
        sliderMaintainability: 0,
        sliderMaintainabilityCalculated: 0,
        maintenance_spks: "CA,CC,CF,CD,CJ,CK,CL,CM,CN,DH,DM,E?,GA,GC,FN,MA,ME,MN,MV,MZ,M?,RA"
    });
    return texts;
}

/** The report settings before anything is loaded (IbaReportsSettingsView.init). */
export function defaultSettings() {
    return {
        jobId: "1",
        reportLanguage: "en_US",
        asianVariant: "false",
        showHeader: false,
        exportFormat: "pdf",
        contactDetails: "Endress+Hauser\nStreet\nCountry-Zip City",
        userName: "Michael Mustermann",
        finalVersion: "draft version",
        hideBudgetPrice: false
    };
}

// --- Translations and templates --------------------------------------------------------

/** The bundle language of a code such as "de_DE": its first two letters, English for none. */
export function bundleLanguage(code) {
    if (!code) return "en";
    return code.length > 2 ? code.substring(0, 2) : code;
}

/** A function key -> text in a language; an unknown key gives the key itself. */
export function translator(translations, code) {
    const language = bundleLanguage(code);
    const texts = (translations && (translations[language] || translations.en)) || {};
    return (key) => (texts[key] === undefined ? key : texts[key]);
}

const HEADINGS = {
    overview_situation: "crgen.fr.current.situation",
    overview_reason: "crgen.fr.reason",
    overview_milestones: "crgen.fr.project",
    overview_impression: "crgen.fr.total.imp",
    overview_matrix: "crgen.fr.prior.matrix",
    overview_standardisation: "crgen.fr.standardisation",
    overview_maintenance: "crgen.fr.breakdown.maint",
    overview_migration: "crgen.fr.migration",
    overview_preventative: "crgen.fr.preventative.maint",
    overview_action: "crgen.fr.action.list",
    standardisation_situation: "crgen.fr.current.situation",
    standardisation_attachment: "crgen.fr.to.be.recomm",
    breakdown_situation: "crgen.fr.current.situation",
    breakdown_attachment: "crgen.fr.to.be.recomm",
    migration_situation_all: "crgen.fr.current.situation",
    migration_situation_eh: "crgen.fr.current.situation",
    migration_situation_others: "crgen.fr.current.situation",
    migration_recommendations: "crgen.fr.to.be.recomm",
    preventative_situation: "crgen.fr.maintenance.status",
    preventative_recommendations: "crgen.fr.to.be.recomm",
    implementation_comment: "crgen.fr.comments"
};

const PLAIN_HINTS = {
    breakdown_high_criticality: "crgen.fr.replace.text",
    breakdown_medium_criticality: "crgen.fr.replace.text"
};

function timeline(headings) {
    let html = '<div style="font-size: 9pt;">\n<font color="#007ca9">\n<table style="width: 762px;" border="0"><tbody  valign="top">\n';
    const cell = '<td style="font-size: 9pt;" align="left" width="200px">';
    for (const heading of headings) {
        html += '<tr style="height: 40px;">\n' + cell + heading + "</td>\n";
        for (let i = 0; i < 3; i++) {
            html += cell + "</td>\n";
        }
        html += "</tr>\n";
    }
    return html + "</tbody></table>\n</font>\n</div>";
}

/** ReportTemplates.template: the template of a report text in the language of t. */
export function template(name, t, year = new Date().getFullYear()) {
    const key = name.toLowerCase();
    switch (key) {
        case "implementation_head1":
            return `Q 1 ${year}`;
        case "implementation_head2":
            return `Q 2 ${year}`;
        case "implementation_head3":
            return `Q 3 ${year}`;
        case "implementation_timeline":
            return timeline([t("crgen.06_0100_10"), t("crgen.06_0100_20"), t("crgen.06_0100_30"), t("crgen.06_0100_40")]);
        default:
            break;
    }
    if (PLAIN_HINTS[key]) {
        return t(PLAIN_HINTS[key]);
    }
    const heading = HEADINGS[key] ? t(HEADINGS[key]) : "";
    return (
        `<div style="font-size:11pt;"><font color="#007ca9">${heading}</font></div>` +
        `<div style="font-size:9.5pt;">${t("crgen.frontend.detail")}</div>`
    );
}

// --- Preset ---------------------------------------------------------------------------

/** ReportPreset: language and preview or final as the delivery suggests them. */
export function applyPreset(settings, preset, stored) {
    if (!preset) return;
    let language = preset.language === "sv_SE" ? "se_SE" : preset.language;
    if (!REPORT_LANGUAGES.includes(language)) language = null;
    if (language && !stored.has("reportLanguage")) {
        settings.reportLanguage = language;
    }
    if (preset.finalReport !== null && preset.finalReport !== undefined && !stored.has("finalVersion")) {
        settings.finalVersion = preset.finalReport ? "final version" : "draft version";
    }
}

// --- State ------------------------------------------------------------------------------

function notStored(section) {
    return section === TEXTS ? TEXTS_NOT_STORED : SETTINGS_NOT_STORED;
}

function fieldNames(section) {
    return section === TEXTS ? SITE_FIELDS : SETTING_FIELDS;
}

function hasTextPrefix(name) {
    return TEXT_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** The stored fields of a model as JSON text per field name (ReportState.fieldsOf). */
export function fieldsOf(section, model) {
    const fields = {};
    for (const name of fieldNames(section)) {
        if (!notStored(section).has(name)) {
            fields[name] = JSON.stringify(model[name] === undefined ? null : model[name]);
        }
    }
    return fields;
}

const withLf = (json) => (json === undefined || json === null ? null : json.split("\\r\\n").join("\\n"));

/**
 * The state of one account: the models, what was loaded or saved last, and the versions.
 * One object per opened account.
 */
export class ReportSession {
    /**
     * @param stored       { texts: {name: {json, version}}, settings: {...} } as loaded
     * @param translations the texts of the translation library by language
     * @param options      { jobId, siteName, preset, year }
     */
    constructor(stored, translations, { jobId, siteName, preset, year } = {}) {
        this.translations = translations;
        this.year = year || new Date().getFullYear();
        this.texts = defaultTexts(jobId, siteName);
        this.settings = defaultSettings();
        this.baseline = {};
        this.versions = { [TEXTS]: {}, [SETTINGS]: {} };

        const storedSettings = (stored && stored.settings) || {};
        this.load(SETTINGS, this.settings, storedSettings);
        applyPreset(this.settings, preset, new Set(Object.keys(storedSettings)));
        this.markSaved(SETTINGS);
        this.load(TEXTS, this.texts, (stored && stored.texts) || {});
        const t = this.translate(this.settings.reportLanguage);
        for (const name of this.emptyTexts()) {
            this.texts[name] = template(name, t, this.year);
        }
        this.markSaved(TEXTS);
        this.templateLanguage = this.settings.reportLanguage;
    }

    translate(code) {
        return translator(this.translations, code);
    }

    load(section, model, stored) {
        const versions = {};
        for (const [name, value] of Object.entries(stored)) {
            if (notStored(section).has(name) || !fieldNames(section).includes(name)) continue;
            model[name] = value.json === null || value.json === undefined ? null : JSON.parse(value.json);
            versions[name] = value.version;
        }
        this.versions[section] = versions;
        this.markSaved(section);
    }

    model(section) {
        return section === TEXTS ? this.texts : this.settings;
    }

    markSaved(section) {
        this.baseline[section] = fieldsOf(section, this.model(section));
    }

    /** Text fields that are still null and get the template (ReportState.emptyTexts). */
    emptyTexts() {
        return Object.entries(fieldsOf(TEXTS, this.texts))
            .filter(([name, json]) => json === "null" && hasTextPrefix(name))
            .map(([name]) => name)
            .sort();
    }

    /** The template of a text in the current report language. */
    templateOf(name) {
        return template(name, this.translate(this.settings.reportLanguage), this.year);
    }

    /**
     * Lets the texts that are still the unchanged template follow a new report language
     * (ReportValuesSession.followLanguage, ReportState.followLanguage).
     * @returns the names of the texts that switched
     */
    followLanguage() {
        const language = this.settings.reportLanguage;
        if (!this.templateLanguage || this.templateLanguage === language || !language) {
            this.templateLanguage = language;
            return [];
        }
        const previous = this.translate(this.templateLanguage);
        const next = this.translate(language);
        const saved = this.baseline[TEXTS];
        const known = this.versions[TEXTS];
        const switched = [];
        for (const [name, json] of Object.entries(fieldsOf(TEXTS, this.texts))) {
            if (!hasTextPrefix(name) || !json.startsWith('"')) continue;
            const before = JSON.stringify(template(name, previous, this.year));
            if (withLf(json) !== withLf(before)) continue;
            const after = JSON.stringify(template(name, next, this.year));
            if (after === json) continue;
            this.texts[name] = JSON.parse(after);
            switched.push(name);
            if (!(name in known)) {
                saved[name] = after;
            }
        }
        this.templateLanguage = language;
        return switched.sort();
    }

    /** The fields that differ from the saved state, line breaks aside (ReportState.changes). */
    changes(section) {
        const saved = this.baseline[section] || {};
        const changed = {};
        for (const [name, json] of Object.entries(fieldsOf(section, this.model(section)))) {
            if (withLf(saved[name]) !== withLf(json)) {
                changed[name] = json;
            }
        }
        return changed;
    }

    /**
     * Records the result of a save (ReportState.saved): a conflicting field keeps the
     * value of this page, its version becomes the stored one, and it is reported once.
     */
    saved(section, written, result) {
        const saved = this.baseline[section];
        const known = this.versions[section];
        for (const [name, json] of Object.entries(written)) {
            saved[name] = json;
            if (result.versions && name in result.versions) {
                known[name] = result.versions[name];
            }
        }
        for (const [name, version] of Object.entries(result.conflicts || {})) {
            if (version < 0) {
                delete known[name];
            } else {
                known[name] = version;
            }
        }
    }

    /** Whether anything differs from what is stored, without changing anything. */
    hasChanges() {
        return Object.keys(this.changes(SETTINGS)).length > 0 || Object.keys(this.changes(TEXTS)).length > 0;
    }

    /** Puts a text back to the template of the report language. */
    reset(name) {
        this.texts[name] = this.templateOf(name);
    }

    /** "Reset all comments": every report text back to its template. */
    resetAll() {
        for (const name of [...REPORT_TEXTS, "implementation_timeline", "implementation_head1", "implementation_head2", "implementation_head3"]) {
            this.reset(name);
        }
    }

    /**
     * What a save sends, section by section: the changed fields with the versions they
     * were loaded with. Settings first, then the language follows, then the texts.
     */
    pendingSaves() {
        const result = [];
        const settings = this.changes(SETTINGS);
        if (Object.keys(settings).length) {
            result.push({ section: SETTINGS, values: settings, versions: { ...this.versions[SETTINGS] } });
        }
        const switched = this.followLanguage();
        const texts = this.changes(TEXTS);
        if (Object.keys(texts).length) {
            result.push({ section: TEXTS, values: texts, versions: { ...this.versions[TEXTS] }, switched });
        }
        return result;
    }
}
