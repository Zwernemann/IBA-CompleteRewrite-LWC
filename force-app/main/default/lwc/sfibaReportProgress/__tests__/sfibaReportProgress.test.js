import { ReportProgress, languageOf, partsFor } from "c/sfibaReportProgress";

const ALL = ["IBA_00_0100_00.rpt", "IBA_02_0300_00_asia.rpt", "IBA_02_0300_00.rpt", "IBA_09_0100_00.rpt"];

describe("c/sfibaReportProgress", () => {
    it("chooses the parts by the report language", () => {
        expect(partsFor(ALL, "de_DE")).toEqual(["IBA_00_0100_00.rpt", "IBA_02_0300_00.rpt", "IBA_09_0100_00.rpt"]);
        expect(partsFor(ALL, "ja_JP")).toEqual(["IBA_00_0100_00.rpt", "IBA_02_0300_00_asia.rpt", "IBA_09_0100_00.rpt"]);
        expect(partsFor(undefined, "de_DE")).toEqual([]);
    });

    it("reads the language off the XML", () => {
        expect(languageOf("<user><u_frontend_language>zh_CN</u_frontend_language></user>")).toBe("zh_CN");
        expect(languageOf("<ibadata/>")).toBe("");
    });

    it("counts the parts by their runs and names the running one", () => {
        const progress = new ReportProgress(["A.rpt", "B.rpt"], 0);
        expect(progress.title).toBe("Loading the report definitions and fonts");
        expect(progress.percent).toBe(0);

        progress.handle({ kind: "phase", phase: "read the data", index: 1, total: 4, ms: 5 });
        expect(progress.title).toBe("Part 1 of 2: A");
        expect(progress.detail).toBe("read the data (1/4)");
        expect(progress.percent).toBe(13);

        progress.handle({ kind: "fact", label: "Records", value: "21" });
        progress.handle({ kind: "fact", label: "Pages", value: "3" });
        progress.handle({ kind: "done", ms: 100 });
        progress.handle({ kind: "phase", phase: "format (final pass)", index: 4, total: 4, ms: 5 });
        progress.handle({ kind: "page", index: 2, total: 5, ms: 1 });
        progress.tick(65000);
        expect(progress.title).toBe("Part 2 of 2: B");
        expect(progress.detail).toBe("format (final pass) (4/4), page 2 of 5");
        expect(progress.facts).toBe("3 pages, 21 records, 1 min 5 s");
        expect(progress.percent).toBe(99);

        progress.handle({ kind: "done", ms: 100 });
        expect(progress.title).toBe("Writing the PDF");
        expect(progress.percent).toBe(100);
    });

    it("works without knowing the parts", () => {
        const progress = new ReportProgress([], 0);
        progress.handle({ kind: "phase", phase: "format", index: 1, total: 2, ms: 1 });
        expect(progress.title).toBe("Part 1");
        expect(progress.percent).toBeNull();
    });
});
