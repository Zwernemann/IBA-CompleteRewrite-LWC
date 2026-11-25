import { LightningElement, api } from "lwc";
import assign from "@salesforce/apex/DibaAttachmentController.assign";
import uploadLogo from "@salesforce/apex/DibaAttachmentController.uploadLogo";
import remove from "@salesforce/apex/DibaAttachmentController.remove";

const MAX_BYTES = 20971520;

/**
 * One attachment of the report (attachmentSlot.xhtml of IBA-Salesforce): the logo (slot 0)
 * or the PDF after a chapter (slots 1 to 6). Shows what is stored, lets choose a file and
 * remove it.
 *
 * Event: attachmentchange { slot, attachment } with null after removing.
 */
export default class DibaAttachment extends LightningElement {
    @api plantId;
    /** 0 is the logo, 1 to 6 the PDF after a chapter. */
    @api position = 1;
    @api attachment;
    @api labels = {};

    busy = false;
    error;

    get isLogo() {
        return Number(this.position) === 0;
    }

    get hasFile() {
        return !!this.attachment;
    }

    get title() {
        return this.labelOf(this.isLogo ? "crgen.fr.logo.select" : "crgen.fr.pdf.select", this.isLogo ? "Logo" : "PDF attachment");
    }

    get removeLabel() {
        return this.labelOf(this.isLogo ? "crgen.fr.logo.remove" : "crgen.fr.pdf.remove", "Remove");
    }

    get uploadLabel() {
        return this.labelOf("crgen.fr.upload", "Upload");
    }

    get icon() {
        return this.isLogo ? "doctype:image" : "doctype:pdf";
    }

    get accept() {
        return this.isLogo ? ".jpg,.jpeg,.png" : ".pdf";
    }

    get acceptList() {
        return [".pdf"];
    }

    get downloadUrl() {
        return this.attachment ? `/sfc/servlet.shepherd/document/download/${this.attachment.documentId}` : null;
    }

    get details() {
        if (!this.attachment) return "";
        const size = this.attachment.size >= 1048576
            ? `${(this.attachment.size / 1048576).toFixed(1)} MB`
            : `${Math.max(1, Math.round(this.attachment.size / 1024))} KB`;
        return size;
    }

    labelOf(key, fallback) {
        return (this.labels && this.labels[key]) || fallback;
    }

    /** A PDF went up with lightning-file-upload; it is given its slot now. */
    async handleUploadFinished(event) {
        const file = (event.detail.files || [])[0];
        if (!file) return;
        await this.run(() => assign({ plantId: this.plantId, slot: Number(this.position), documentId: file.documentId }));
    }

    async handleLogo(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (file.size > MAX_BYTES) {
            this.error = "The file has more than 20 MB.";
            return;
        }
        await this.run(async () => {
            const jpeg = await toJpegBase64(file);
            const name = file.name.replace(/\.png$/i, ".jpg");
            return uploadLogo({ plantId: this.plantId, fileName: name, base64Jpeg: jpeg });
        });
    }

    async handleRemove() {
        await this.run(async () => {
            await remove({ plantId: this.plantId, slot: Number(this.position) });
            return null;
        });
    }

    async run(action) {
        this.busy = true;
        this.error = null;
        try {
            const attachment = await action();
            this.dispatchEvent(new CustomEvent("attachmentchange", { detail: { slot: Number(this.position), attachment } }));
        } catch (e) {
            this.error = (e && e.body && e.body.message) || (e && e.message) || String(e);
        } finally {
            this.busy = false;
        }
    }
}

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * The logo as Base64 JPEG: a JPEG as it is, a PNG drawn on white and written as JPEG, as
 * IbaTools.encodeToJpg did; the CRGenerator expects JPEG.
 */
async function toJpegBase64(file) {
    const dataUrl = await readAsDataUrl(file);
    if (!/\.png$/i.test(file.name)) {
        return dataUrl.substring(dataUrl.indexOf(",") + 1);
    }
    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Not an image that can be read"));
        img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const jpeg = canvas.toDataURL("image/jpeg", 0.75);
    return jpeg.substring(jpeg.indexOf(",") + 1);
}
