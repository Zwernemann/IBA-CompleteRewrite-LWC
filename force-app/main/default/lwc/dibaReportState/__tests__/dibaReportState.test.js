import { readFileSync } from "fs";
import { join } from "path";
import { ReportSession, SETTINGS, TEXTS, applyPreset, fieldsOf, template, translator } from "c/dibaReportState";

const ROOT = join(__dirname, "../../../../../..");
const TRANSLATIONS = JSON.parse(readFileSync(join(ROOT, "force-app/main/default/staticresources/dibaTranslations.json"), "utf8"));
const TEMPLATES = JSON.parse(readFileSync(join(ROOT, "test/reporttexts/templates.json"), "utf8"));

describe("c-diba-report-state", () => {
    it("writes every template as ReportTemplates does, in every language", () => {
        for (const [language, templates] of Object.entries(TEMPLATES)) {
            const t = translator(TRANSLATIONS, language);
            for (const [name, expected] of Object.entries(templates)) {
                expect([language, name, template(name, t, 2026)]).toEqual([
                    language,
                    name,
                    expected.split("{year}").join("2026")
                ]);
            }
        }
    });

    it("fills texts never stored with the template of the report language", () => {
        const session = new ReportSession({ texts: {}, settings: {} }, TRANSLATIONS, { jobId: "001", siteName: "Nord", year: 2026 });
        expect(session.texts.overview_situation).toContain("Current situation");
        expect(session.texts.implementation_head1).toBe("Q 1 2026");
        // Templates are not stored until someone changes them.
        expect(session.hasChanges()).toBe(false);
        expect(session.texts.sliderStandardisation).toBe(100);
        expect(session.settings.finalVersion).toBe("draft version");
    });

    it("loads stored values with their versions", () => {
        const session = new ReportSession(
            {
                texts: { overview_reason: { json: '"mine"', version: 3 }, sliderMaintenance: { json: "70", version: 1 } },
                settings: { reportLanguage: { json: '"de_DE"', version: 0 } }
            },
            TRANSLATIONS,
            { year: 2026 }
        );
        expect(session.texts.overview_reason).toBe("mine");
        expect(session.texts.sliderMaintenance).toBe(70);
        expect(session.texts.overview_situation).toContain("Aktuelle Situation");
        expect(session.versions[TEXTS].overview_reason).toBe(3);
    });

    it("applies the preset of the delivery where nothing is stored", () => {
        const settings = { reportLanguage: "en_US", finalVersion: "draft version" };
        applyPreset(settings, { language: "sv_SE", finalReport: true }, new Set());
        expect(settings).toEqual({ reportLanguage: "se_SE", finalVersion: "final version" });
        const stored = { reportLanguage: "de_DE", finalVersion: "draft version" };
        applyPreset(stored, { language: "fr_FR", finalReport: true }, new Set(["reportLanguage", "finalVersion"]));
        expect(stored).toEqual({ reportLanguage: "de_DE", finalVersion: "draft version" });
        const unknown = { reportLanguage: "en_US" };
        applyPreset(unknown, { language: "xx_XX" }, new Set());
        expect(unknown.reportLanguage).toBe("en_US");
    });

    it("lets unchanged templates follow a new report language, edited texts stay", () => {
        const session = new ReportSession({ texts: { overview_reason: { json: '"mine"', version: 0 } } }, TRANSLATIONS, { year: 2026 });
        session.settings.reportLanguage = "de_DE";
        const saves = session.pendingSaves();
        expect(saves[0].section).toBe(SETTINGS);
        expect(JSON.parse(saves[0].values.reportLanguage)).toBe("de_DE");
        expect(session.texts.overview_situation).toContain("Aktuelle Situation");
        expect(session.texts.overview_reason).toBe("mine");
        // Templates never stored stay unstored after switching.
        expect(saves.length).toBe(1);
    });

    it("compares without line breaks and records conflicts once", () => {
        const session = new ReportSession({ texts: { overview_reason: { json: '"a\\nb"', version: 2 } } }, TRANSLATIONS, { year: 2026 });
        session.texts.overview_reason = "a\r\nb";
        expect(session.changes(TEXTS)).toEqual({});
        session.texts.overview_reason = "changed";
        const written = session.changes(TEXTS);
        expect(written).toEqual({ overview_reason: '"changed"' });
        session.saved(TEXTS, written, { versions: {}, conflicts: { overview_reason: 5 } });
        expect(session.versions[TEXTS].overview_reason).toBe(5);
        expect(session.changes(TEXTS)).toEqual({});
    });

    it("resets texts to the template", () => {
        const session = new ReportSession({ texts: { overview_reason: { json: '"mine"', version: 0 } } }, TRANSLATIONS, { year: 2026 });
        session.reset("overview_reason");
        expect(session.texts.overview_reason).toContain("Reason");
        session.texts.implementation_head2 = "x";
        session.resetAll();
        expect(session.texts.implementation_head2).toBe("Q 2 2026");
    });

    it("stores fields as JSON text, without the calculated ones", () => {
        const fields = fieldsOf(TEXTS, { sliderProcessCriticality: 4, sliderMaintenance: 50, overview_reason: null });
        expect(fields.sliderProcessCriticality).toBeUndefined();
        expect(fields.sliderMaintenance).toBe("50");
        expect(fields.overview_reason).toBe("null");
    });
});
