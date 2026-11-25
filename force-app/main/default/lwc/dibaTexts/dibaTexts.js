import TRANSLATIONS_URL from "@salesforce/resourceUrl/dibaTranslations";
import LANG from "@salesforce/i18n/lang";
import { translator } from "c/dibaReportState";

/**
 * The texts of the E+H translation library (static resource dibaTranslations), loaded
 * once per page. The user interface speaks the language of the Salesforce user where the
 * library has it, otherwise English; the report speaks its own report language.
 */

let loading;

export function loadTranslations() {
    if (!loading) {
        loading = fetch(TRANSLATIONS_URL)
            .then((response) => {
                if (!response.ok) throw new Error(`Translations not loaded: ${response.status}`);
                return response.json();
            })
            .catch((error) => {
                loading = null;
                throw error;
            });
    }
    return loading;
}

/** The language code of the Salesforce user as the library names languages, such as "de". */
export function userLanguage() {
    const code = (LANG || "en").toLowerCase();
    if (code.startsWith("zh")) return "cn";
    if (code.startsWith("sv")) return "se";
    return code.substring(0, 2);
}

/** A function key -> text in the language of the user interface. */
export function uiTranslator(translations) {
    return translator(translations, userLanguage());
}
