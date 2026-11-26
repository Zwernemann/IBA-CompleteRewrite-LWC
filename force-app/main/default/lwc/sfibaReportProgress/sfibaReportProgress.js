/**
 * What the CRGenerator reports while it creates the IBA report, turned into what the
 * consultant reads: which part runs, in which phase, how far, and what came out so far.
 *
 * The CRGenerator runs the parts of the virtual report "IBA Report" one after another and
 * passes on the events of each run (phase, step, fact, page, done) without naming the
 * part. The part is therefore counted here: every "done" ends one. Which parts run is
 * known before (describeReport); a choice between a part and its Asian variant is made by
 * the report language, as the report descriptor does.
 */

const ASIAN_LANGUAGES = ["ja_JP", "zh_CN", "zh_TW", "ko_KR"];

/** The parts that run for this language, from all the parts the report may consist of. */
export function partsFor(allParts, language) {
    const parts = (allParts || []).map(String);
    const asian = ASIAN_LANGUAGES.includes(language);
    const names = new Set(parts);
    return parts.filter((part) => {
        const isAsia = /_asia\.rpt$/i.test(part);
        if (asian) {
            return isAsia || !names.has(part.replace(/\.rpt$/i, "_asia.rpt"));
        }
        return !isAsia;
    });
}

/** The report language as the XML carries it. */
export function languageOf(xml) {
    const match = /<u_frontend_language>([^<]*)<\/u_frontend_language>/.exec(xml || "");
    return match ? match[1] : "";
}

function partName(file) {
    return String(file || "").replace(/\.rpt$/i, "");
}

function seconds(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}

export class ReportProgress {
    constructor(parts, now = Date.now()) {
        this.parts = parts || [];
        this.started = now;
        this.now = now;
        this.stage = "load"; // load, run, write, done
        this.partIndex = 0;
        this.phase = "";
        this.phaseIndex = 0;
        this.phaseTotal = 0;
        this.page = null;
        this.partRecords = 0;
        this.partPages = 0;
        this.records = 0;
        this.pages = 0;
    }

    /** Takes one event of the CRGenerator (onProgress). */
    handle(event) {
        if (!event) return;
        switch (event.kind) {
            case "phase":
                this.stage = "run";
                this.phase = event.phase;
                this.phaseIndex = event.index;
                this.phaseTotal = event.total;
                break;
            case "page":
                this.page = { index: event.index, total: event.total };
                break;
            case "fact":
                if (event.label === "Records") this.partRecords = Number(event.value) || 0;
                if (event.label === "Pages") this.partPages = Number(event.value) || 0;
                break;
            case "done":
                this.records += this.partRecords;
                this.pages += this.partPages;
                this.partRecords = 0;
                this.partPages = 0;
                this.partIndex += 1;
                this.phase = "";
                this.phaseIndex = 0;
                this.phaseTotal = 0;
                this.page = null;
                if (this.parts.length > 0 && this.partIndex >= this.parts.length) {
                    this.stage = "write";
                }
                break;
            default:
                break;
        }
    }

    /** The PDF is being written after the last part, or everything is over. */
    writing() {
        this.stage = "write";
    }

    finished() {
        this.stage = "done";
    }

    tick(now = Date.now()) {
        this.now = now;
    }

    /** Percent of the parts done, the running part by its phases; null without a total. */
    get percent() {
        const total = this.parts.length;
        if (this.stage === "write" || this.stage === "done") return 100;
        if (!total) return null;
        const within = this.phaseTotal > 0 ? this.phaseIndex / this.phaseTotal : 0;
        return Math.min(99, Math.round((100 * (this.partIndex + within)) / total));
    }

    get title() {
        switch (this.stage) {
            case "load":
                return "Loading the report definitions and fonts";
            case "write":
                return "Writing the PDF";
            case "done":
                return "Report created";
            default: {
                const number = this.partIndex + 1;
                const of = this.parts.length ? ` of ${this.parts.length}` : "";
                const name = this.parts[this.partIndex] ? `: ${partName(this.parts[this.partIndex])}` : "";
                return `Part ${number}${of}${name}`;
            }
        }
    }

    get detail() {
        if (this.stage !== "run") return "";
        const bits = [];
        if (this.phase) {
            bits.push(this.phaseTotal ? `${this.phase} (${this.phaseIndex}/${this.phaseTotal})` : this.phase);
        }
        if (this.page) bits.push(`page ${this.page.index} of ${this.page.total}`);
        return bits.join(", ");
    }

    get facts() {
        const bits = [];
        if (this.pages > 0) bits.push(`${this.pages} pages`);
        if (this.records > 0) bits.push(`${this.records} records`);
        bits.push(seconds(this.now - this.started));
        return bits.join(", ");
    }
}
