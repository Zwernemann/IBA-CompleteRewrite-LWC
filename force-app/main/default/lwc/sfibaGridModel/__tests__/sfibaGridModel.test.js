import { displayValue, filterRows, sortRows, windowOf } from "c/sfibaGridModel";

const columns = [
    { field: "tag", label: "Tag" },
    { field: "crit", label: "Criticality", type: "select", options: [{ value: "high", label: "High" }, { value: "low", label: "Low" }] },
    { field: "safety", label: "Safety", type: "checkbox" }
];

const rows = [
    { id: "1", tag: "TIC-10", crit: "high", safety: true },
    { id: "2", tag: "tic-2", crit: "low", safety: false },
    { id: "3", tag: null, crit: null, safety: null },
    { id: "4", tag: "PIC-1", crit: "high", safety: false }
];

describe("c-sfiba-grid-model", () => {
    it("shows select labels, yes and no, empty for null", () => {
        expect(displayValue(columns[1], rows[0])).toBe("High");
        expect(displayValue(columns[2], rows[0])).toBe("Yes");
        expect(displayValue(columns[2], rows[1])).toBe("No");
        expect(displayValue(columns[0], rows[2])).toBe("");
    });

    it("filters text by contains without case and selects by value", () => {
        expect(filterRows(rows, columns, { tag: "tic" }).map((r) => r.id)).toEqual(["1", "2"]);
        expect(filterRows(rows, columns, { crit: "high" }).map((r) => r.id)).toEqual(["1", "4"]);
        expect(filterRows(rows, columns, { safety: "false" }).map((r) => r.id)).toEqual(["2", "3", "4"]);
        expect(filterRows(rows, columns, { tag: "tic", crit: "low" }).map((r) => r.id)).toEqual(["2"]);
        expect(filterRows(rows, columns, { tag: "" })).toBe(rows);
    });

    it("sorts naturally, empty values last in both directions", () => {
        expect(sortRows(rows, columns[0], "asc").map((r) => r.id)).toEqual(["4", "2", "1", "3"]);
        expect(sortRows(rows, columns[0], "desc").map((r) => r.id)).toEqual(["1", "2", "4", "3"]);
        expect(sortRows(rows, null, "asc")).toBe(rows);
    });

    it("renders only the rows in view", () => {
        const w = windowOf(50000, 32 * 1000, 640, 32, 10);
        expect(w.start).toBe(990);
        expect(w.end).toBe(990 + 20 + 20);
        expect(w.top).toBe(990 * 32);
        expect(w.top + (w.end - w.start) * 32 + w.bottom).toBe(50000 * 32);
        expect(windowOf(0, 0, 640, 32)).toEqual({ start: 0, end: 0, top: 0, bottom: 0 });
    });

    it("filters and sorts 50,000 rows quickly", () => {
        const big = [];
        for (let i = 0; i < 50000; i++) {
            big.push({ id: String(i), tag: `TAG-${i}`, crit: i % 3 ? "high" : "low", safety: i % 2 === 0 });
        }
        const started = Date.now();
        const filtered = filterRows(big, columns, { tag: "1", crit: "high" });
        const sorted = sortRows(filtered, columns[0], "desc");
        const elapsed = Date.now() - started;
        expect(sorted.length).toBeGreaterThan(10000);
        expect(elapsed).toBeLessThan(2000);
    });
});
