import { checkValue, editFor, prepareRow, refreshCalculated, toText, yearsBetween } from "c/dibaRowLogic";

const today = new Date(Date.UTC(2026, 9, 25)); // 2026-10-25

describe("c-diba-row-logic", () => {
    it("applies an edit while Salesforce delivers the value it was made on", () => {
        const row = prepareRow({
            device_ordercode: "CODE-1",
            edits: [{ field: "device_ordercode", value: "NEW-1", salesforceValue: "CODE-1" }]
        });
        expect(row.device_ordercode).toBe("NEW-1");
        expect(row.sf.device_ordercode).toBe("CODE-1");
        expect(row.edits.device_ordercode.value).toBe("NEW-1");
    });

    it("drops an edit when Salesforce delivers another value", () => {
        const row = prepareRow({
            device_ordercode: "CODE-2",
            edits: [{ field: "device_ordercode", value: "NEW-1", salesforceValue: "CODE-1" }]
        });
        expect(row.device_ordercode).toBe("CODE-2");
    });

    it("holds switches and special demands as text", () => {
        expect(toText("device_property_safetyrelevant", true)).toBe("true");
        expect(toText("device_specialdemands", false)).toBe("0");
        const row = prepareRow({
            device_specialdemands: false,
            edits: [{ field: "device_specialdemands", value: "1", salesforceValue: "0" }]
        });
        expect(row.device_specialdemands).toBe(true);
    });

    it("removes the edit when the value equals Salesforce again", () => {
        const row = prepareRow({ device_ordercode: "CODE-1", edits: [] });
        expect(editFor(row, "device_ordercode", "X")).toEqual({
            field: "device_ordercode",
            value: "X",
            salesforceValue: "CODE-1"
        });
        expect(editFor(row, "device_ordercode", "CODE-1").value).toBeNull();
    });

    it("checks dates and lengths as MasterField.check", () => {
        expect(checkValue("device_manufacturingdate", "2019-03-01")).toBeNull();
        expect(checkValue("device_manufacturingdate", "2019-02-30")).toContain("is not a date");
        expect(checkValue("devicetype_spk", "x".repeat(33))).toBe(
            "SPK is limited to 32 characters, the entry has 33."
        );
        expect(checkValue("add_nu_price", "12,5")).toContain("is not a number");
        expect(checkValue("add_nu_price", "12.5")).toBeNull();
    });

    it("counts the age as the inherited code did", () => {
        expect(yearsBetween(today, "2020-01-01")).toBe(-7);
    });

    it("obsolescence by age for other manufacturers", () => {
        const row = { supplier_name: "Other", device_manufacturingdate: "2010-05-01" };
        refreshCalculated(row, today);
        expect(row.device_obsolence).toBe("high");
        row.device_manufacturingdate = "2018-05-01";
        refreshCalculated(row, today);
        expect(row.device_obsolence).toBe("medium");
        row.device_manufacturingdate = "2024-05-01";
        refreshCalculated(row, today);
        expect(row.device_obsolence).toBe("low");
    });

    it("obsolescence by product status for Endress+Hauser", () => {
        const row = { supplier_name: "Endress+Hauser", device_productstatus: "Phase out" };
        expect(refreshCalculated(row, today)).toBe(true);
        expect(row.device_obsolence).toBe("medium");
        expect(refreshCalculated(row, today)).toBe(false);
        row.device_productstatus = null;
        refreshCalculated(row, today);
        expect(row.device_obsolence).toBe("notset");
    });

    it("risk of maintenance in the order of the inherited code", () => {
        const row = { device_accessibility: "easy", device_maint_effectivness: "high" };
        refreshCalculated(row, today);
        expect(row.device_riskofmaint).toBe("high");
        row.device_maint_effectivness = "";
        refreshCalculated(row, today);
        expect(row.device_riskofmaint).toBe("notset");
        row.device_accessibility = "moderate";
        row.device_maint_effectivness = "low";
        refreshCalculated(row, today);
        expect(row.device_riskofmaint).toBe("normal");
    });
});
