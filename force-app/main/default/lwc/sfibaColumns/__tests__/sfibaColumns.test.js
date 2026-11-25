import { VIEWS, columnsFor } from "c/sfibaColumns";

const t = (key) => `[${key}]`;

describe("c-sfiba-columns", () => {
    it("has the columns of the four dialogs of IBA-Salesforce", () => {
        expect(columnsFor("maintenance", t)).toHaveLength(20);
        expect(columnsFor("breakdown", t)).toHaveLength(14);
        expect(columnsFor("migration", t)).toHaveLength(13);
        expect(columnsFor("preventative", t)).toHaveLength(20);
        expect(Object.keys(VIEWS)).toEqual(["maintenance", "breakdown", "migration", "preventative"]);
    });

    it("lets edit master data of other manufacturers only", () => {
        const code = columnsFor("maintenance", t).find((c) => c.field === "device_ordercode");
        expect(code.editable({ supplier_name: "Endress+Hauser" })).toBe(false);
        expect(code.editable({ supplier_name: "Other" })).toBe(true);
        expect(code.label).toBe("[crgen.fr.ordercode]");
    });

    it("edits only consultant fields in breakdown and migration", () => {
        for (const view of ["breakdown", "migration"]) {
            const editable = columnsFor(view, t)
                .filter((c) => c.editable)
                .map((c) => c.field);
            expect(editable.every((f) => f.startsWith("add_"))).toBe(true);
        }
    });
});
