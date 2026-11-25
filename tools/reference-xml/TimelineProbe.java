import de.maz.eh.iba.core.report.IbaSiteValues;
public class TimelineProbe {
    public static void main(String[] args) {
        String[] cells = {
            "<font color=\"#007ca9\">Standardisation </font>",
            "&nbsp;",
            "Grüße &amp; Maß € – “x” <b>fett</b>",
            "a<br>b<br/>c",
            "<p>Absatz</p><p>zwei</p>",
            "  viel   Raum \n neu  ",
            "<span style=\"color: rgb(1, 2, 3);\" title='a\"b'>x</span>",
            "<div>block <i>i</i></div>",
            "<ul><li>eins</li><li>zwei</li></ul>",
            "",
            "<b> fett </b> <i>kursiv</i>",
            "5 < 6 > 4", "<span title=\"x<y>&z\">t</span>", "\uD83D\uDE00 emoji", "<table><tr><td>innen</td></tr></table>", "<h2>Titel</h2>text", "<a href=\"http://x?a=1&b=2\">link</a>",
        };
        StringBuilder html = new StringBuilder("<table><tbody><tr>");
        for (String c : cells) html.append("<td>").append(c).append("</td>");
        html.append("</tr><tr><td>zweite Zeile</td></tr></tbody></table>");
        IbaSiteValues v = new IbaSiteValues();
        v.setImplementation_timeline(html.toString());
        v.convertImplementationTimeline();
        try {
            com.fasterxml.jackson.databind.ObjectMapper m = new com.fasterxml.jackson.databind.ObjectMapper();
            java.util.Map<String, String> out = new java.util.LinkedHashMap<>();
            out.put("html", html.toString());
            out.put("converted", v.getImplementation_timeline_converted());
            System.out.println(m.writerWithDefaultPrettyPrinter().writeValueAsString(out));
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
