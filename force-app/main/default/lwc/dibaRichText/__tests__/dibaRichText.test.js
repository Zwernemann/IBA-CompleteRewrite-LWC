import { createElement } from "lwc";
import DibaRichText from "c/dibaRichText";

const cleanHtml = (html) => html.replace(/ lwc-[a-z0-9]+(="")?/g, "");

describe("c-diba-rich-text", () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    it("shows the HTML as it is and reports a change when left", async () => {
        const element = createElement("c-diba-rich-text", { is: DibaRichText });
        element.name = "overview_reason";
        element.value = '<div style="font-size:11pt;"><font color="#007ca9">Reason</font></div>';
        const changed = jest.fn();
        element.addEventListener("change", changed);
        document.body.appendChild(element);
        await Promise.resolve();

        const editor = element.shadowRoot.querySelector(".diba-rich-editor");
        expect(cleanHtml(editor.innerHTML)).toBe('<div style="font-size:11pt;"><font color="#007ca9">Reason</font></div>');

        editor.innerHTML = '<b lwc-7thv7bqblib="">new</b>';
        editor.dispatchEvent(new CustomEvent("input"));
        editor.dispatchEvent(new CustomEvent("blur"));
        // The scoping attribute of the synthetic shadow DOM does not reach the text.
        expect(changed.mock.calls[0][0].detail).toEqual({ name: "overview_reason", value: "<b>new</b>" });
    });

    it("does not report when nothing was typed", async () => {
        const element = createElement("c-diba-rich-text", { is: DibaRichText });
        element.value = "x";
        const changed = jest.fn();
        element.addEventListener("change", changed);
        document.body.appendChild(element);
        await Promise.resolve();
        element.shadowRoot.querySelector(".diba-rich-editor").dispatchEvent(new CustomEvent("blur"));
        expect(changed).not.toHaveBeenCalled();
    });

    it("offers reset and page break", async () => {
        const element = createElement("c-diba-rich-text", { is: DibaRichText });
        element.name = "overview_reason";
        element.showPagebreak = true;
        const reset = jest.fn();
        const pagebreak = jest.fn();
        element.addEventListener("reset", reset);
        element.addEventListener("pagebreak", pagebreak);
        document.body.appendChild(element);
        await Promise.resolve();
        element.shadowRoot.querySelector('[data-id="reset"]').click();
        const box = element.shadowRoot.querySelector('[data-id="pagebreak"]');
        box.checked = true;
        box.dispatchEvent(new CustomEvent("change"));
        expect(reset).toHaveBeenCalled();
        expect(pagebreak.mock.calls[0][0].detail).toEqual({ name: "overview_reason", checked: true });
    });

    it("warns about a text the report cuts off", async () => {
        const element = createElement("c-diba-rich-text", { is: DibaRichText });
        element.value = "x".repeat(24001);
        element.tooLongMessage = "too long";
        document.body.appendChild(element);
        await Promise.resolve();
        expect(element.shadowRoot.textContent).toContain("too long");
    });
});

