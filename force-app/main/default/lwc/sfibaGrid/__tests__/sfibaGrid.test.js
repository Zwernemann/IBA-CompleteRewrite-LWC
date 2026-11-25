import { createElement } from "lwc";
import SfibaGrid from "c/sfibaGrid";

const columns = [
    { field: "tag", label: "Tag", width: 100, editable: () => true },
    { field: "maker", label: "Manufacturer", width: 100 },
    {
        field: "crit",
        label: "Criticality",
        type: "select",
        options: [
            { value: "high", label: "high" },
            { value: "low", label: "low" }
        ],
        editable: () => true
    },
    { field: "safety", label: "Safety", type: "checkbox", editable: () => true }
];

function bigRows(count) {
    const rows = [];
    for (let i = 0; i < count; i++) {
        rows.push({ id: `r${i}`, tag: `TAG-${i}`, maker: i % 2 ? "Endress+Hauser" : "Other", crit: "high", safety: false });
    }
    return rows;
}

function flush() {
    return Promise.resolve();
}

describe("c-sfiba-grid", () => {
    let element;

    beforeEach(() => {
        element = createElement("c-sfiba-grid", { is: SfibaGrid });
        element.columns = columns;
        element.height = 320;
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it("renders only the rows in view of 50,000", async () => {
        element.rows = bigRows(50000);
        document.body.appendChild(element);
        await flush();
        const rendered = element.shadowRoot.querySelectorAll(".sfiba-row");
        expect(rendered.length).toBeGreaterThan(0);
        expect(rendered.length).toBeLessThan(60);
        expect(element.shownCount).toBe(50000);
    });

    it("filters by the text of a column", async () => {
        element.rows = bigRows(30);
        document.body.appendChild(element);
        await flush();
        const filter = element.shadowRoot.querySelector('input.sfiba-filter[data-field="tag"]');
        filter.value = "TAG-2";
        filter.dispatchEvent(new CustomEvent("input"));
        await flush();
        // TAG-2 and TAG-20 to TAG-29
        expect(element.shownCount).toBe(11);
    });

    it("edits a cell and reports the change when it is left", async () => {
        element.rows = bigRows(5);
        const handler = jest.fn();
        element.addEventListener("cellchange", handler);
        document.body.appendChild(element);
        await flush();

        const cell = element.shadowRoot.querySelector('.sfiba-cell[data-key="r1"][data-field="tag"]');
        cell.click();
        await flush();
        const editor = element.shadowRoot.querySelector("input.sfiba-editor");
        expect(editor).not.toBeNull();
        editor.value = "NEW";
        editor.dispatchEvent(new CustomEvent("blur"));
        await flush();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({ key: "r1", field: "tag", value: "NEW" });
        expect(element.shadowRoot.querySelector("input.sfiba-editor")).toBeNull();
    });

    it("does not edit a cell that is not editable", async () => {
        element.rows = bigRows(5);
        document.body.appendChild(element);
        await flush();
        element.shadowRoot.querySelector('.sfiba-cell[data-key="r1"][data-field="maker"]').click();
        await flush();
        expect(element.shadowRoot.querySelector(".sfiba-editor")).toBeNull();
    });

    it("reports a switch at once", async () => {
        element.rows = bigRows(5);
        const handler = jest.fn();
        element.addEventListener("cellchange", handler);
        document.body.appendChild(element);
        await flush();
        const box = element.shadowRoot.querySelector('input[type="checkbox"][data-key="r0"]');
        box.checked = true;
        box.dispatchEvent(new CustomEvent("change"));
        expect(handler.mock.calls[0][0].detail).toEqual({ key: "r0", field: "safety", value: true });
    });

    it("sorts by a column", async () => {
        element.rows = [
            { id: "a", tag: "B" },
            { id: "b", tag: "A" }
        ];
        document.body.appendChild(element);
        await flush();
        element.shadowRoot.querySelector('button.sfiba-sort[data-field="tag"]').click();
        await flush();
        const first = element.shadowRoot.querySelector(".sfiba-row");
        expect(first.dataset.key).toBe("b");
    });
});
