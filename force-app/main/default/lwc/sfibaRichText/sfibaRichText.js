import { LightningElement, api } from "lwc";

/**
 * Editor for one report text. The HTML stays as it is: the templates are made of colours,
 * font sizes and font tags, and the CRGenerator puts them into the report unchanged
 * (iba-editor.js of IBA-Salesforce switched SunEditor's filters off for that reason).
 * Toolbar as before: bold, italic, underline; beside it reset and page break.
 *
 * Events:
 *   change      { value }       the text, when the editor is left after a change
 *   reset                       the consultant wants the template back
 *   pagebreak   { checked }     the page break switch
 */
/**
 * The HTML of the editor without what the synthetic shadow DOM adds to it: an attribute
 * lwc-<hash> on every element for the scoped styles. It must not reach the report.
 */
function cleanHtml(html) {
    return html.replace(/ lwc-[a-z0-9]+(="")?/g, "");
}

export default class SfibaRichText extends LightningElement {
    @api label;
    @api name;
    @api pagebreak = false;
    @api showPagebreak = false;
    @api height = 200;
    @api maxWidth = "800px";
    @api resetLabel = "Reset";
    @api pagebreakLabel = "Page break";
    @api tooLongMessage;
    @api maxLength = 24000;

    _value = "";
    rendered = false;
    dirty = false;

    @api
    get value() {
        return this._value;
    }
    set value(html) {
        this._value = html === null || html === undefined ? "" : html;
        // Only write into the editor when the text came from outside, not while typing.
        if (this.rendered && !this.dirty) {
            this.writeEditor();
        }
    }

    get editorStyle() {
        return `min-height: ${this.height}px; max-width: ${this.maxWidth};`;
    }

    get frameStyle() {
        return `max-width: ${this.maxWidth};`;
    }

    get tooLong() {
        return this._value.length > this.maxLength;
    }

    renderedCallback() {
        if (!this.rendered) {
            this.rendered = true;
            this.writeEditor();
        }
    }

    writeEditor() {
        const editor = this.template.querySelector(".sfiba-rich-editor");
        if (editor && cleanHtml(editor.innerHTML) !== this._value) {
            // eslint-disable-next-line @lwc/lwc/no-inner-html
            editor.innerHTML = this._value;
        }
    }

    handleInput() {
        this.dirty = true;
    }

    handleBlur() {
        if (!this.dirty) return;
        this.dirty = false;
        const editor = this.template.querySelector(".sfiba-rich-editor");
        this._value = cleanHtml(editor.innerHTML);
        this.dispatchEvent(new CustomEvent("change", { detail: { name: this.name, value: this._value } }));
    }

    handleFormat(event) {
        event.preventDefault();
        const command = event.currentTarget.dataset.command;
        const editor = this.template.querySelector(".sfiba-rich-editor");
        editor.focus();
        if (typeof document.execCommand === "function") {
            document.execCommand(command, false, null);
        }
        this.dirty = true;
    }

    handleReset() {
        this.dirty = false;
        this.dispatchEvent(new CustomEvent("reset", { detail: { name: this.name } }));
    }

    handlePagebreak(event) {
        this.dispatchEvent(new CustomEvent("pagebreak", { detail: { name: this.name, checked: event.target.checked } }));
    }
}
