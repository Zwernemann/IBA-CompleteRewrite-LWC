import de.maz.eh.iba.core.report.ReportTemplates;
import de.maz.eh.iba.core.util.Translations;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Year;
import java.util.*;

/**
 * Exports the texts of the E+H translation library (bundle CR_ApplicationResources) per
 * language, as IBA-Salesforce reads them through Translations, and the report templates of
 * ReportTemplates per report language.
 *
 *   java -cp <iba-core and its dependencies> ExportTranslations.java <texts.json> <templates.json>
 */
public class ExportTranslations {
    static final String[] LANGUAGES = { "en", "cn", "de", "es", "fi", "fr", "it", "nl", "pl", "pt", "ru", "se" };
    static final String[] TEXTS = { "overview_situation", "overview_reason", "overview_milestones",
        "overview_impression", "overview_matrix", "overview_standardisation", "overview_maintenance",
        "overview_migration", "overview_preventative", "overview_action", "overview_attachment",
        "standardisation_situation", "standardisation_attachment", "breakdown_high_criticality",
        "breakdown_medium_criticality", "breakdown_situation", "breakdown_attachment", "migration_situation_all",
        "migration_situation_eh", "migration_situation_others", "migration_recommendations",
        "preventative_situation", "preventative_recommendations", "implementation_comment",
        "implementation_timeline", "implementation_head1", "implementation_head2", "implementation_head3" };

    public static void main(String[] args) throws Exception {
        Map<String, Map<String, String>> texts = new TreeMap<>();
        Map<String, Map<String, String>> templates = new TreeMap<>();
        String year = Year.now().toString();
        for (String language : LANGUAGES) {
            ResourceBundle bundle = ResourceBundle.getBundle("de.maz.eh.ufl.CR_ApplicationResources", new Locale(language));
            Map<String, String> values = new TreeMap<>();
            for (String key : Collections.list(bundle.getKeys())) {
                values.put(key, bundle.getString(key));
            }
            texts.put(language, values);
            Translations translations = Translations.of(language);
            Map<String, String> byText = new LinkedHashMap<>();
            for (String name : TEXTS) {
                byText.put(name, ReportTemplates.template(name, translations).replace(year, "{year}"));
            }
            templates.put(language, byText);
        }
        ObjectMapper mapper = new ObjectMapper();
        Files.writeString(Path.of(args[0]), mapper.writeValueAsString(texts));
        Files.writeString(Path.of(args[1]), mapper.writerWithDefaultPrettyPrinter().writeValueAsString(templates));
    }
}
