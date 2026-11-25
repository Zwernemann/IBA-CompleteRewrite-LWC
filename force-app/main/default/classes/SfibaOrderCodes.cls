/**
 * The Order Code Transformer of E+H: the successor of an older order code
 * (OrderCodeTransformerClient and OrderCodeSuccessors of IBA-Salesforce). The service takes
 * a list of order codes and answers per code with an error code and, if there is one, the
 * successor. Its address is the setting SFIBA_Setting.Order_Code_Transformer_URL.
 *
 * A successor found goes into add_ordercode_transform and add_recomend_ordercode of the row.
 */
public with sharing class SfibaOrderCodes {
    /** The result for a code the service knows (error code 0) but without successor. */
    public static final String NO_SUCCESSOR = '-';
    /** Codes per request; an account can have thousands of different codes. */
    public static final Integer CODES_PER_CALLOUT = 500;
    public static final Integer TIMEOUT_MS = 60000;

    public class TransformerException extends Exception {
    }

    public static String url() {
        SFIBA_Setting__mdt setting = SFIBA_Setting__mdt.getInstance('Order_Code_Transformer_URL');
        return setting == null ? null : setting.SFIBA_Value__c;
    }

    /**
     * Looks up order codes; empty codes and repetitions are left out.
     *
     * @return per code the service answered with error code 0: the successor, NO_SUCCESSOR
     *         if there is none, or '' if it sent an empty one. Other codes are missing.
     */
    public static Map<String, String> lookup(Set<String> orderCodes) {
        List<String> codes = new List<String>();
        for (String code : orderCodes) {
            if (String.isNotEmpty(code)) {
                codes.add(code);
            }
        }
        Map<String, String> results = new Map<String, String>();
        String endpoint = url();
        if (codes.isEmpty() || String.isBlank(endpoint)) {
            return results;
        }
        for (Integer start = 0; start < codes.size(); start += CODES_PER_CALLOUT) {
            List<String> chunk = new List<String>();
            for (Integer i = start; i < Math.min(codes.size(), start + CODES_PER_CALLOUT); i++) {
                chunk.add(codes[i]);
            }
            results.putAll(call(endpoint, chunk));
        }
        return results;
    }

    private static Map<String, String> call(String endpoint, List<String> codes) {
        HttpRequest request = new HttpRequest();
        request.setEndpoint(endpoint);
        request.setMethod('POST');
        request.setTimeout(TIMEOUT_MS);
        request.setHeader('Content-Type', 'application/xml; charset=utf-8');
        request.setHeader('Accept', 'application/xml');
        request.setBody(requestXml(codes));
        HttpResponse response;
        try {
            response = new Http().send(request);
        } catch (CalloutException e) {
            throw new TransformerException(
                'Order Code Transformer not reachable: ' + endpoint + ' (' + e.getMessage() + ')'
            );
        }
        if (response.getStatusCode() != 200) {
            throw new TransformerException(
                'Order Code Transformer answered with status ' +
                    response.getStatusCode() +
                    ': ' +
                    endpoint
            );
        }
        return parse(response.getBody());
    }

    @TestVisible
    private static String requestXml(List<String> codes) {
        String xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><multipleOrderCodes><multipleOrderCodes>';
        for (String code : codes) {
            xml +=
                '<orderCode>' +
                code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') +
                '</orderCode>';
        }
        return xml + '</multipleOrderCodes></multipleOrderCodes>';
    }

    @TestVisible
    private static Map<String, String> parse(String body) {
        Map<String, String> results = new Map<String, String>();
        Dom.Document document = new Dom.Document();
        try {
            document.load(body);
        } catch (Exception e) {
            throw new TransformerException('Cannot read the answer of the Order Code Transformer');
        }
        for (Dom.XmlNode responses : document.getRootElement().getChildElements()) {
            if (responses.getName() != 'orderCodeResponses') {
                continue;
            }
            for (Dom.XmlNode response : responses.getChildElements()) {
                if (response.getName() != 'orderCodeResponse') {
                    continue;
                }
                Dom.XmlNode requested = response.getChildElement('requestedOrderCode', null);
                Dom.XmlNode errorCode = response.getChildElement('errorCode', null);
                if (requested == null || errorCode == null || errorCode.getText().trim() != '0') {
                    continue;
                }
                Dom.XmlNode successor = response.getChildElement('responseOrderCode', null);
                results.put(
                    requested.getText().trim(),
                    successor == null ? NO_SUCCESSOR : successor.getText().trim()
                );
            }
        }
        return results;
    }

    /** The order code that applies: the edit while it applies, else the one from Salesforce. */
    public static String effectiveCode(SFIBA_Row__c row) {
        for (SFIBA_Master_Edit__c edit : row.SFIBA_Master_Edits__r) {
            if (edit.SFIBA_Field__c == 'device_ordercode') {
                String stored = String.isEmpty(edit.SFIBA_Salesforce_Value__c)
                    ? null
                    : edit.SFIBA_Salesforce_Value__c;
                String current = String.isEmpty(row.SFIBA_Device_Ordercode__c)
                    ? null
                    : row.SFIBA_Device_Ordercode__c;
                if (stored == current || (stored != null && stored.equals(current))) {
                    return edit.SFIBA_Value__c;
                }
            }
        }
        return row.SFIBA_Device_Ordercode__c;
    }

    /** Enters a result into a row; returns whether the row changed. */
    public static Boolean apply(String result, SFIBA_Row__c row) {
        if (String.isEmpty(result)) {
            return false;
        }
        Boolean changed =
            !result.equals(row.SFIBA_Add_Ordercode_Transform__c) ||
            !result.equals(row.SFIBA_Add_Recomend_Ordercode__c);
        row.SFIBA_Add_Ordercode_Transform__c = result;
        row.SFIBA_Add_Recomend_Ordercode__c = result;
        return changed;
    }
}
