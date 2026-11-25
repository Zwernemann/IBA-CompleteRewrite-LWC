import { createElement } from "lwc";
import DibaReportSettingsModal from "c/dibaReportSettingsModal";

describe("c-diba-report-settings-modal", () => {
    it("offers the twelve report languages and the settings", async () => {
        const element = createElement("c-diba-report-settings-modal", { is: DibaReportSettingsModal });
        element.settings = { reportLanguage: "de_DE", finalVersion: "draft version", userName: "A" };
        element.maintenanceSpks = "CA,CC";
        document.body.appendChild(element);
        await Promise.resolve();
        const language = element.shadowRoot.querySelector('lightning-combobox[data-field="reportLanguage"]');
        expect(language.options.length).toBe(12);
        expect(language.value).toBe("de_DE");
        expect(element.shadowRoot.querySelector('lightning-textarea[data-field="maintenance_spks"]').value).toBe("CA,CC");
    });
});
