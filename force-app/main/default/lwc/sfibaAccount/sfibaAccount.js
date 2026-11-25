import { LightningElement, api } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import loadValues from "@salesforce/apex/SfibaReportValuesController.load";
import saveValues from "@salesforce/apex/SfibaReportValuesController.save";
import getIntervals from "@salesforce/apex/SfibaIntervalController.getIntervals";
import listAttachments from "@salesforce/apex/SfibaAttachmentController.listAttachments";
import SfibaMaintenanceModal from "c/sfibaMaintenanceModal";
import SfibaReportSettingsModal from "c/sfibaReportSettingsModal";
import SfibaIntervalModal from "c/sfibaIntervalModal";
import { VIEWS } from "c/sfibaColumns";
import { ReportSession, translator } from "c/sfibaReportState";
import { devicesOf, reportXml, sliderPercentages } from "c/sfibaReportXml";
import { loadRows } from "c/sfibaRowStore";
import { loadTranslations, userLanguage } from "c/sfibaTexts";

const SAVE_DELAY = 800;
const MAX_LENGTH = 24000;
/** The user of the report XML is a technical placeholder, as in IBA-Salesforce. */
const TECHNICAL_USER = 1;

/** The report texts per tab, with the translation key of their heading (ibaJob_*.xhtml). */
const TAB_TEXTS = {
    overview: [
        ["crgen.fr.current.situation", "overview_situation"],
        ["crgen.fr.reason", "overview_reason"],
        ["crgen.fr.project", "overview_milestones"],
        ["crgen.fr.total.imp", "overview_impression"],
        ["crgen.fr.prior.matrix", "overview_matrix"],
        ["crgen.fr.standardisation", "overview_standardisation"],
        ["crgen.fr.breakdown.maint", "overview_maintenance"],
        ["crgen.fr.migration", "overview_migration"],
        ["crgen.fr.preventative.maint", "overview_preventative"],
        ["crgen.fr.action.list", "overview_action"]
    ],
    standardisation: [
        ["crgen.fr.current.situation", "standardisation_situation"],
        ["crgen.fr.to.be.recomm", "standardisation_attachment"]
    ],
    breakdown: [
        ["crgen.fr.current.sit.all", "breakdown_situation"],
        ["crgen.fr.to.be.recomm", "breakdown_attachment"]
    ],
    migration: [
        ["crgen.fr.current.sit.all", "migration_situation_all"],
        ["crgen.fr.current.sit.eh", "migration_situation_eh"],
        ["crgen.fr.current.sit.other", "migration_situation_others"],
        ["crgen.fr.to.be.recomm", "migration_recommendations"]
    ],
    preventative: [
        ["crgen.fr.maintenance.status", "preventative_situation"],
        ["crgen.fr.to.be.recomm", "preventative_recommendations"]
    ],
    implementation: [["crgen.fr.comments", "implementation_comment"]]
};

/** The sliders of the tab Indicators; the calculated ones are only shown. */
const SLIDERS = [
    ["crgen.fr.number.manufact", "sliderManufacturers", false],
    ["crgen.fr.standard.asset.type", "sliderStandardisation", false],
    ["crgen.fr.process.crit", "sliderProcessCriticality", true],
    ["crgen.fr.risk.of.maintainability", "sliderMaintainability", false],
    ["crgen.fr.maintenance.relevance", "sliderMaintenance", false]
];

/**
 * One account with the tabs of the former working page (ibaJob.xhtml): indicators, report
 * texts per chapter, report settings. Everything is saved while the consultant works;
 * a field someone else saved in the meantime is not overwritten and is named.
 */
export default class SfibaAccount extends NavigationMixin(LightningElement) {
    @api account;

    loading = true;
    error;
    loadedRows = 0;
    translations;
    session;
    rows = [];
    intervals;
    messages = [];
    revision = 0;
    attachmentMap = {};
    saving = false;
    saveTimer;

    connectedCallback() {
        this.load();
    }

    disconnectedCallback() {
        this.flush();
    }

    async load() {
        this.loading = true;
        try {
            const [translations, stored, rows, attachments] = await Promise.all([
                loadTranslations(),
                loadValues({ accountDataId: this.account.recordId }),
                loadRows(this.account.recordId, (count) => {
                    this.loadedRows = count;
                }),
                listAttachments({ accountDataId: this.account.recordId })
            ]);
            this.translations = translations;
            this.attachmentMap = attachments || {};
            this.rows = rows;
            const preset = {
                language: stored.presetLanguage,
                finalReport:
                    stored.presetFinalReport === null || stored.presetFinalReport === undefined
                        ? null
                        : stored.presetFinalReport === "true"
            };
            this.session = new ReportSession(stored, translations, {
                jobId: stored.jobId,
                siteName: stored.siteName,
                preset
            });
            this.calculateSliders();
        } catch (e) {
            this.error = reduceError(e);
        } finally {
            this.loading = false;
        }
    }

    calculateSliders() {
        const calculated = sliderPercentages(this.rows);
        this.session.texts.sliderProcessCriticality = calculated.processCriticality;
        this.session.texts.sliderMaintainabilityCalculated = calculated.maintainability;
    }

    // --- texts of the user interface ------------------------------------------------------

    get t() {
        return translator(this.translations, userLanguage());
    }

    get ready() {
        return !this.loading && !this.error && this.session;
    }

    get title() {
        return this.account ? this.account.name : "";
    }

    get rowCount() {
        return `${this.rows.length || (this.account && this.account.rowCount) || 0} rows`;
    }

    get progress() {
        return `${this.loadedRows} rows loaded`;
    }

    get labels() {
        const t = this.t;
        return {
            indicators: t("crgen.fr.indicators"),
            overview: t("crgen.fr.overview"),
            standardisation: t("crgen.fr.standard"),
            breakdown: t("crgen.fr.breakdown"),
            migration: t("crgen.fr.migration"),
            preventative: t("crgen.fr.preventative"),
            implementation: t("crgen.fr.implementation"),
            editAssets: t(VIEWS.maintenance),
            editBreakdown: t(VIEWS.breakdown),
            editMigration: t(VIEWS.migration),
            editPreventative: t(VIEWS.preventative),
            editIntervals: t("crgen.fr.edit.interval.tab"),
            settings: t("crgen.fr.rep.settings"),
            timeline: t("crgen.fr.timeline"),
            highCriticality: t("crgen.fr.crit.high.text"),
            mediumCriticality: t("crgen.fr.crit.med.text"),
            xml: "Report XML"
        };
    }

    get saveState() {
        if (this.saving) return "Saving";
        return this.session && this.session.hasChanges() ? "Changes not yet saved" : "All changes saved";
    }

    get hasMessages() {
        return this.messages.length > 0;
    }

    textsOf(tab) {
        // eslint-disable-next-line no-unused-expressions
        this.revision;
        const t = this.t;
        const texts = this.session.texts;
        return TAB_TEXTS[tab].map(([key, name]) => ({
            name,
            label: t(key),
            value: texts[name] || "",
            pagebreak: texts[`${name}_pagebreak`] === true,
            showPagebreak: true,
            resetLabel: t("crgen.fr.reset.input"),
            pagebreakLabel: t("crgen.fr.page.break"),
            tooLongMessage: `This text is longer than ${MAX_LENGTH} characters; the report cuts it off.`
        }));
    }

    get overviewTexts() {
        return this.textsOf("overview");
    }
    get standardisationTexts() {
        return this.textsOf("standardisation");
    }
    get breakdownTexts() {
        return this.textsOf("breakdown");
    }
    get migrationTexts() {
        return this.textsOf("migration");
    }
    get preventativeTexts() {
        return this.textsOf("preventative");
    }
    get implementationTexts() {
        return this.textsOf("implementation");
    }

    get timelineText() {
        // eslint-disable-next-line no-unused-expressions
        this.revision;
        const t = this.t;
        return {
            name: "implementation_timeline",
            label: t("crgen.fr.timeline"),
            value: this.session.texts.implementation_timeline || "",
            resetLabel: t("crgen.fr.reset.input"),
            tooLongMessage: `This text is longer than ${MAX_LENGTH} characters; the report cuts it off.`
        };
    }

    get heads() {
        // eslint-disable-next-line no-unused-expressions
        this.revision;
        return ["implementation_head1", "implementation_head2", "implementation_head3"].map((name) => ({
            name,
            value: this.session.texts[name] || ""
        }));
    }

    get criticalityTexts() {
        // eslint-disable-next-line no-unused-expressions
        this.revision;
        const texts = this.session.texts;
        return [
            { name: "breakdown_high_criticality", label: this.labels.highCriticality, value: texts.breakdown_high_criticality || "" },
            { name: "breakdown_medium_criticality", label: this.labels.mediumCriticality, value: texts.breakdown_medium_criticality || "" }
        ];
    }

    get sliders() {
        // eslint-disable-next-line no-unused-expressions
        this.revision;
        const t = this.t;
        const texts = this.session.texts;
        return SLIDERS.map(([key, name, calculated]) => ({
            name,
            label: t(key),
            value: Number(texts[name]) || 0,
            disabled: calculated,
            hint:
                name === "sliderMaintainability"
                    ? `(calc. ${texts.sliderMaintainabilityCalculated}%)`
                    : null
        }));
    }

    /** The attachments by slot, as s0 (logo) to s6 for the template. */
    get attachments() {
        const result = {};
        for (let slot = 0; slot <= 6; slot++) {
            result[`s${slot}`] = this.attachmentMap[slot] || this.attachmentMap[String(slot)] || null;
        }
        return result;
    }

    get uiLabels() {
        return (this.translations && this.translations[userLanguage()]) || {};
    }

    handleAttachmentChange(event) {
        const { slot, attachment } = event.detail;
        const next = { ...this.attachmentMap };
        delete next[String(slot)];
        if (attachment) next[slot] = attachment;
        else delete next[slot];
        this.attachmentMap = next;
    }

    // --- changes ----------------------------------------------------------------------------

    changed() {
        this.revision++;
        clearTimeout(this.saveTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY);
    }

    handleTextChange(event) {
        this.session.texts[event.detail.name] = event.detail.value;
        this.changed();
    }

    handleTextReset(event) {
        this.session.reset(event.detail.name);
        this.changed();
    }

    handlePagebreak(event) {
        this.session.texts[`${event.detail.name}_pagebreak`] = event.detail.checked;
        this.changed();
    }

    handleSlider(event) {
        const name = event.target.dataset.name;
        this.session.texts[name] = Math.round(Number(event.target.value) || 0);
        this.changed();
    }

    handlePlainText(event) {
        const name = event.target.dataset.name;
        this.session.texts[name] = event.target.value;
        this.changed();
    }

    /** Saves what changed; one save at a time. */
    @api
    async flush() {
        clearTimeout(this.saveTimer);
        if (this.saving || !this.session) return;
        const saves = this.session.pendingSaves();
        if (!saves.length) {
            this.revision++;
            return;
        }
        this.saving = true;
        try {
            for (const save of saves) {
                // Settings before texts, as IBA-Salesforce saves them.
                // eslint-disable-next-line no-await-in-loop
                const result = await saveValues({
                    accountDataId: this.account.recordId,
                    section: save.section,
                    valuesJson: JSON.stringify(save.values),
                    versionsJson: JSON.stringify(save.versions)
                });
                this.session.saved(save.section, save.values, result);
                const conflicts = Object.keys(result.conflicts || {});
                if (conflicts.length) {
                    this.addMessage(
                        `Changed by someone else in the meantime, not saved: ${conflicts.join(", ")}. ` +
                            "Your text is still shown; changing it again saves it."
                    );
                }
            }
        } catch (e) {
            this.addMessage(`Saving failed: ${reduceError(e)}`);
        } finally {
            this.saving = false;
            this.revision++;
        }
    }

    addMessage(text) {
        this.messages = [...this.messages, { id: `${Date.now()}-${this.messages.length}`, text }];
    }

    handleDismiss() {
        this.messages = [];
    }

    // --- dialogs and actions ----------------------------------------------------------------

    async handleOpenAssets(event) {
        const view = (event && event.currentTarget && event.currentTarget.dataset.view) || "maintenance";
        await SfibaMaintenanceModal.open({
            size: "full",
            description: "Asset table of the account",
            accountDataId: this.account.recordId,
            accountName: this.account.name,
            view,
            title: this.t(VIEWS[view])
        });
        // The table works on the same rows; the sliders follow its changes.
        this.calculateSliders();
        this.revision++;
        this.dispatchEvent(new CustomEvent("changed"));
    }

    async handleOpenIntervals() {
        await SfibaIntervalModal.open({
            size: "full",
            description: "Interval table of the account",
            accountDataId: this.account.recordId,
            accountName: this.account.name
        });
        // The report takes the table anew.
        this.intervals = null;
    }

    async handleOpenSettings() {
        const result = await SfibaReportSettingsModal.open({
            size: "small",
            description: "Report settings",
            settings: { ...this.session.settings },
            maintenanceSpks: this.session.texts.maintenance_spks,
            labels: (this.translations && this.translations[userLanguage()]) || {}
        });
        if (!result) return;
        if (result.action === "resetAll") {
            this.session.resetAll();
        } else if (result.action === "save") {
            Object.assign(this.session.settings, result.settings);
            this.session.texts.maintenance_spks = result.maintenanceSpks;
        }
        this.changed();
        await this.flush();
    }

    /** The report XML as the CRGenerator gets it. */
    @api
    async buildReportXml() {
        if (!this.intervals) {
            const table = await getIntervals({ accountDataId: this.account.recordId });
            this.intervals = table.rows;
        }
        this.calculateSliders();
        const texts = this.session.texts;
        const name = this.account.name;
        return reportXml({
            devices: devicesOf(this.rows, {
                accountId: this.account.accountKey,
                siteName: texts.siteName,
                intervals: this.intervals
            }),
            sitevalue: texts,
            user: {
                u_userid: TECHNICAL_USER,
                u_loginprintname: name,
                u_reportlanguage: "en",
                u_reportaddress: "",
                isAdmin: false,
                u_frontend_language: userLanguage(),
                u_loginname: this.account.accountKey,
                hub_email: "",
                hub_first_name: "",
                hub_last_name: name
            },
            intervals: this.intervals,
            reportsettings: this.session.settings
        });
    }

    async handleDownloadXml() {
        try {
            const xml = await this.buildReportXml();
            // Large accounts give more than 100 MB; a data URL would not hold that.
            const url = URL.createObjectURL(new Blob([xml], { type: "application/octet-stream" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "ibareport.xml";
            link.click();
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e) {
            this.addMessage(`Report XML not built: ${reduceError(e)}`);
        }
    }

    /** Back to the account the button was pressed on. */
    async handleBack() {
        await this.flush();
        this[NavigationMixin.Navigate]({
            type: "standard__recordPage",
            attributes: { recordId: this.account.accountId, objectApiName: "Account", actionName: "view" }
        });
    }
}

function reduceError(error) {
    if (!error) return "unknown error";
    if (error.body && error.body.message) return error.body.message;
    if (error.message) return error.message;
    return String(error);
}
