/**
 * The report XML against references written by the Java code of IBA-Salesforce
 * (test/reportxml/README.md): the 20-row test account and the Pfizer account with 2,358 rows.
 * Equal character for character, or the contract with the Crystal templates is broken.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { gunzipSync } from "zlib";
import {
    convertTimeline,
    devicesOf,
    fineTune,
    javaFloat,
    reportXml,
    sliderPercentages,
    surrogate,
    writeXml
} from "c/sfibaReportXml";

const DIR = join(__dirname, "../../../../../../test/reportxml");

function read(name) {
    const data = readFileSync(join(DIR, name));
    return (name.endsWith(".gz") ? gunzipSync(data) : data).toString("utf8");
}

function layoutOf(input) {
    return {
        devices: devicesOf(input.rows, {
            accountId: input.accountId,
            siteName: input.sitevalue.siteName,
            intervals: input.intervals
        }),
        sitevalue: input.sitevalue,
        user: input.user,
        intervals: input.intervals,
        reportsettings: input.reportsettings
    };
}

/** The first differing line, so that a failure says where. */
function firstDifference(actual, expected) {
    const a = actual.split("\n");
    const e = expected.split("\n");
    for (let i = 0; i < Math.max(a.length, e.length); i++) {
        if (a[i] !== e[i]) {
            return `line ${i + 1}\n  actual:   ${a[i]}\n  expected: ${e[i]}`;
        }
    }
    return null;
}

describe("c-sfiba-report-xml", () => {
    it("writes the XML of the test account as JAXB does", () => {
        const input = JSON.parse(read("testanlage.input.json"));
        const raw = writeXml(layoutOf(input));
        expect(firstDifference(raw, read("testanlage.raw.xml"))).toBeNull();
    });

    it("fine tunes it as the CRGenerator gets it", () => {
        const input = JSON.parse(read("testanlage.input.json"));
        const xml = reportXml(layoutOf(input));
        expect(firstDifference(xml, read("testanlage.xml"))).toBeNull();
    });

    it("writes the XML of the Pfizer account, 2,358 rows", () => {
        const input = JSON.parse(read("pfizer.input.json.gz"));
        const started = Date.now();
        const xml = reportXml(layoutOf(input));
        const elapsed = Date.now() - started;
        expect(firstDifference(xml, read("pfizer.xml.gz"))).toBeNull();
        expect(elapsed).toBeLessThan(5000);
    });

    it("converts the timeline as Jsoup does", () => {
        const probe = JSON.parse(read("timeline.json"));
        expect(convertTimeline(probe.html)).toBe(probe.converted);
        expect(convertTimeline(null)).toBe("");
    });

    it("numbers texts as ReportXmlFields.surrogate", () => {
        // Values from the Java reference of the test account.
        expect(surrogate("account:0017Q00000TsTdAQAV")).toBe(3757808308967);
        expect(surrogate("supplier:")).toBe(243481871792349);
    });

    it("writes floats as Java", () => {
        expect(javaFloat(0)).toBe("0.0");
        expect(javaFloat(12.5)).toBe("12.5");
        expect(javaFloat(1234.56)).toBe("1234.56");
        expect(javaFloat(0.1)).toBe("0.1");
        expect(javaFloat(19.35)).toBe("19.35");
        expect(javaFloat(12345678)).toBe("1.2345678E7");
        expect(javaFloat(0.0001)).toBe("1.0E-4");
    });

    it("leaves text without lists and breaks as it is", () => {
        expect(fineTune("&lt;b&gt;x&lt;/b&gt;")).toBe("&lt;b&gt;x&lt;/b&gt;");
        expect(fineTune("a&lt;br /&gt;b")).toBe("a&lt;br&gt;b");
    });

    it("calculates the sliders as IbaDeviceTools", () => {
        const rows = [
            { device_criticality: "high", device_riskofmaint: "high" },
            { device_criticality: "medium", device_riskofmaint: "normal" },
            { device_criticality: "low", device_riskofmaint: "low" },
            { device_criticality: "notset", device_riskofmaint: "high" }
        ];
        // maintenance: high + normal counted -> (3 + 2) / 2 = 2.5 -> 75
        // criticality: high, medium counted (risk normal/high), notset not -> (3 + 2) / 2 -> 75
        expect(sliderPercentages(rows)).toEqual({ maintainability: 75, processCriticality: 75 });
        expect(sliderPercentages([])).toEqual({ maintainability: 0, processCriticality: 0 });
    });

    it("writes 50,000 rows in reasonable time", () => {
        const input = JSON.parse(read("pfizer.input.json.gz"));
        const rows = [];
        for (let i = 0; i < 50000; i++) {
            rows.push({ ...input.rows[i % input.rows.length], device_oid: String(i + 1) });
        }
        const started = Date.now();
        const xml = reportXml({ ...layoutOf({ ...input, rows }) });
        const elapsed = Date.now() - started;
        expect(xml.length).toBeGreaterThan(100000000);
        expect(elapsed).toBeLessThan(30000);
    });
});
