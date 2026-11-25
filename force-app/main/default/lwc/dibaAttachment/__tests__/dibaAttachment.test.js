import { createElement } from "lwc";
import DibaAttachment from "c/dibaAttachment";
import assign from "@salesforce/apex/DibaAttachmentController.assign";
import remove from "@salesforce/apex/DibaAttachmentController.remove";

jest.mock("@salesforce/apex/DibaAttachmentController.assign", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaAttachmentController.uploadLogo", () => ({ default: jest.fn() }), { virtual: true });
jest.mock("@salesforce/apex/DibaAttachmentController.remove", () => ({ default: jest.fn() }), { virtual: true });

async function settle() {
    for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

describe("c-diba-attachment", () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    it("offers the upload of a PDF on the account and assigns it to its slot", async () => {
        const stored = { slot: 3, documentId: "069A", fileName: "plan.pdf", size: 2097152 };
        assign.mockResolvedValue(stored);
        const element = createElement("c-diba-attachment", { is: DibaAttachment });
        element.accountDataId = "a01A";
        element.position = 3;
        const changed = jest.fn();
        element.addEventListener("attachmentchange", changed);
        document.body.appendChild(element);
        await settle();

        const upload = element.shadowRoot.querySelector('[data-id="pdf"]');
        expect(upload.recordId).toBe("a01A");
        upload.dispatchEvent(new CustomEvent("uploadfinished", { detail: { files: [{ documentId: "069A" }] } }));
        await settle();
        expect(assign).toHaveBeenCalledWith({ accountDataId: "a01A", slot: 3, documentId: "069A" });
        expect(changed.mock.calls[0][0].detail).toEqual({ slot: 3, attachment: stored });
    });

    it("shows a stored file and removes it", async () => {
        remove.mockResolvedValue(undefined);
        const element = createElement("c-diba-attachment", { is: DibaAttachment });
        element.accountDataId = "a01A";
        element.position = 0;
        element.attachment = { slot: 0, documentId: "069B", fileName: "logo.jpg", size: 2048 };
        const changed = jest.fn();
        element.addEventListener("attachmentchange", changed);
        document.body.appendChild(element);
        await settle();
        expect(element.shadowRoot.querySelector('[data-id="download"]').href).toContain("/sfc/servlet.shepherd/document/download/069B");
        element.shadowRoot.querySelector('[data-id="remove"]').click();
        await settle();
        expect(remove).toHaveBeenCalledWith({ accountDataId: "a01A", slot: 0 });
        expect(changed.mock.calls[0][0].detail).toEqual({ slot: 0, attachment: null });
    });

    it("names what went wrong", async () => {
        assign.mockRejectedValue({ body: { message: "Only PDF files can be attached." } });
        const element = createElement("c-diba-attachment", { is: DibaAttachment });
        element.accountDataId = "a01A";
        element.position = 1;
        document.body.appendChild(element);
        await settle();
        element.shadowRoot
            .querySelector('[data-id="pdf"]')
            .dispatchEvent(new CustomEvent("uploadfinished", { detail: { files: [{ documentId: "069C" }] } }));
        await settle();
        expect(element.shadowRoot.textContent).toContain("Only PDF files can be attached.");
    });
});
