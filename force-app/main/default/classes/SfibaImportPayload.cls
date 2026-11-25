/**
 * One part of a delivery in schema v3: checked against the rules of the schema, then
 * mapped onto the records of the package.
 *
 * Apex has no JSON Schema validator, so the rules of docs/schema/iba-import.schema.json
 * are checked here by hand, every objection with its location, as the former endpoint
 * did. A change of the schema has to be made in both places.
 *
 * The class knows nothing about DML; SfibaImport stores what it maps.
 */
public with sharing class SfibaImportPayload {
    /** The tag id of a row for an asset without a measuring point. */
    public static final String NO_TAG = '';

    /** Known picklist values in lower case; another value is stored as not set. */
    public static final Map<String, Set<String>> PICKLISTS = new Map<String, Set<String>>{
        'FSLEH_Criticality__c' => new Set<String>{ 'low', 'medium', 'high', 'notset' },
        'FSLEH_Accessibility__c' => new Set<String>{ 'easy', 'moderate', 'difficult', 'notset' },
        'FSLEH_Maintenance_effectiveness__c' => new Set<String>{ 'low', 'medium', 'high' },
        'FSLEH_Environmental_Conditions__c' => new Set<String>{ 'normal', 'heavy', 'notset' }
    };

    /** The parameter type: stored as sent, an unknown value is only named in the answer. */
    public static final String PARAMETER_TYPE = 'FSLEH_ParameterType__c';

    public static final Set<String> PARAMETER_TYPES = new Set<String>{
        'analysis',
        'conductivity',
        'density',
        'electricity',
        'energy',
        'flow',
        'force',
        'frequency',
        'humidity',
        'length',
        'mass',
        'other',
        'ph',
        'power',
        'pressure',
        'radioactivity',
        'speed',
        'temperature',
        'time',
        'torque',
        'turbidity',
        'vibration',
        'viscosity',
        'volume'
    };

    private static final Set<String> YES_NO_FIELDS = new Set<String>{
        'FSLEH_Special_Demands__c',
        'FSLEH_Environmental_Relevant__c',
        'FSLEH_Safety_Relevant__c',
        'FSLEH_Quality_Relevant__c'
    };

    private static final Set<String> TAG_TEXT_FIELDS = new Set<String>{
        'FSLEH_ParameterType__c',
        'FSLEH_Location_Name__c',
        'FSLEH_Criticality__c',
        'FSLEH_Accessibility__c',
        'FSLEH_Maintenance_effectiveness__c',
        'FSLEH_Environmental_Conditions__c',
        'FSLEH_ParentTAG__c'
    };

    private static final Set<String> ASSET_TEXT_FIELDS = new Set<String>{
        'Name',
        'Manufacturer_List__c',
        'Order_Code__c',
        'Order_Code_Extended__c',
        'SerialNumber',
        'Device_Type2__c',
        'deviceTypeValue',
        'Manufacturing_Date__c',
        'FSLEH_Product_Status_Formula__c'
    };

    private static final Set<String> ROOT_KEYS = new Set<String>{
        'transmission',
        'account',
        'location',
        'unassignedAssets'
    };
    private static final Set<String> TRANSMISSION_KEYS = new Set<String>{
        'id',
        'part',
        'partCount',
        'sentAt',
        'language',
        'isFinalReport'
    };
    private static final Set<String> ROW_KEYS = new Set<String>{ 'tag', 'asset' };

    private static final String ID_PATTERN = '[a-zA-Z0-9]{15,18}';

    public String transmissionId;
    public Integer part;
    public Integer partCount;
    public String accountId;
    public String accountName;
    public String countryCode;
    public String language;
    public Boolean finalReport;
    public List<SFIBA_Row__c> rows = new List<SFIBA_Row__c>();
    public Integer tagsWithoutAsset = 0;
    public Map<String, Set<String>> unknownValues = new Map<String, Set<String>>();
    public String contentHash;

    private SfibaImportPayload() {
    }

    /** Reads, checks and maps one part. */
    public static SfibaImportPayload parse(String json) {
        Object parsed;
        try {
            parsed = System.JSON.deserializeUntyped(json);
        } catch (Exception e) {
            throw new SfibaImport.ImportException(
                'Die gesendeten Daten sind kein gueltiges JSON: ' + e.getMessage()
            );
        }
        List<String> problems = new List<String>();
        new Checker(problems).root(parsed);
        if (!problems.isEmpty()) {
            problems.sort();
            throw new SfibaImport.ImportException(
                'Die gesendeten Daten entsprechen nicht dem ' +
                    'vereinbarten Schema: ' +
                    String.join(problems, '; ')
            );
        }

        Map<String, Object> root = (Map<String, Object>) parsed;
        Map<String, Object> transmission = (Map<String, Object>) root.get('transmission');
        Map<String, Object> account = (Map<String, Object>) root.get('account');

        SfibaImportPayload payload = new SfibaImportPayload();
        payload.transmissionId = (String) transmission.get('id');
        payload.part = toInteger(transmission.get('part'));
        payload.partCount = toInteger(transmission.get('partCount'));
        payload.language = (String) transmission.get('language');
        payload.finalReport = (Boolean) transmission.get('isFinalReport');
        payload.accountId = (String) account.get('Id');
        payload.accountName = (String) account.get('Name');
        payload.countryCode = (String) account.get('BillingCountryCode');
        payload.mapRows(root);
        // Re-serialised, so that spaces and line breaks do not count as content.
        payload.contentHash = EncodingUtil.convertToHex(
            Crypto.generateDigest('SHA-256', Blob.valueOf(System.JSON.serialize(parsed)))
        );
        return payload;
    }

    /** The account record of the account, with the presets only where the part has them. */
    public SFIBA_Account__c accountData() {
        SFIBA_Account__c accountData = new SFIBA_Account__c(
            SFIBA_Account_Key__c = accountId,
            Name = accountName.left(80),
            SFIBA_Account_Name__c = accountName.left(255),
            SFIBA_Country_Code__c = countryCode == null ? null : countryCode.left(10)
        );
        if (language != null) {
            accountData.SFIBA_Preset_Language__c = language;
        }
        if (finalReport != null) {
            accountData.SFIBA_Preset_Final_Report__c = String.valueOf(finalReport);
        }
        return accountData;
    }

    /** Key of a row: account id, tag id and asset id. */
    public static String rowKey(String accountId, String tagId, String assetId) {
        return accountId + '/' + tagId + '/' + assetId;
    }

    // --- Mapping ------------------------------------------------------------------------

    private void mapRows(Map<String, Object> root) {
        Map<String, SFIBA_Row__c> byKey = new Map<String, SFIBA_Row__c>();
        Set<String> assetsAtATag = new Set<String>();

        for (Object locationObject : (List<Object>) root.get('location')) {
            Map<String, Object> location = (Map<String, Object>) locationObject;
            String locationName = (String) location.get('Name');
            for (Object entryObject : (List<Object>) location.get('rows')) {
                Map<String, Object> entry = (Map<String, Object>) entryObject;
                Map<String, Object> tag = (Map<String, Object>) entry.get('tag');
                noteUnknownValues(tag);
                if (entry.get('asset') == null) {
                    tagsWithoutAsset++;
                    continue;
                }
                Map<String, Object> asset = (Map<String, Object>) entry.get('asset');
                SFIBA_Row__c row = newRow((String) tag.get('Id'), (String) asset.get('Id'));
                mapTag(row, tag, locationName);
                mapAsset(row, asset);
                // A later occurrence of the same row replaces the earlier one.
                byKey.put(row.SFIBA_Row_Key__c, row);
                assetsAtATag.add((String) asset.get('Id'));
            }
        }
        if (root.get('unassignedAssets') != null) {
            for (Object assetObject : (List<Object>) root.get('unassignedAssets')) {
                Map<String, Object> asset = (Map<String, Object>) assetObject;
                String assetId = (String) asset.get('Id');
                if (assetsAtATag.contains(assetId)) {
                    continue;
                }
                SFIBA_Row__c row = newRow(NO_TAG, assetId);
                mapAsset(row, asset);
                byKey.put(row.SFIBA_Row_Key__c, row);
            }
        }
        rows = byKey.values();
    }

    private SFIBA_Row__c newRow(String tagId, String assetId) {
        return new SFIBA_Row__c(
            SFIBA_Row_Key__c = rowKey(accountId, tagId, assetId),
            SFIBA_Tag_Id__c = String.isEmpty(tagId) ? null : tagId,
            SFIBA_Asset_Id__c = assetId,
            SFIBA_Account__r = new SFIBA_Account__c(SFIBA_Account_Key__c = accountId)
        );
    }

    /** Every master field is written, also when empty: a delivery overwrites master data. */
    private static void mapTag(SFIBA_Row__c row, Map<String, Object> tag, String locationName) {
        row.SFIBA_Device_Tag__c = text(tag, 'Name');
        row.SFIBA_Device_Measuringtask__c = text(tag, PARAMETER_TYPE);
        String tagLocation = text(tag, 'FSLEH_Location_Name__c');
        row.SFIBA_Location_Name__c = (tagLocation != null ? tagLocation : locationName);
        if (row.SFIBA_Location_Name__c != null) {
            row.SFIBA_Location_Name__c = row.SFIBA_Location_Name__c.left(255);
        }
        row.SFIBA_Device_Criticality__c = picklist(tag, 'FSLEH_Criticality__c');
        row.SFIBA_Device_Accessibility__c = picklist(tag, 'FSLEH_Accessibility__c');
        row.SFIBA_Device_Maint_Effectivness__c = picklist(
            tag,
            'FSLEH_Maintenance_effectiveness__c'
        );
        row.SFIBA_Device_Conditions__c = picklist(tag, 'FSLEH_Environmental_Conditions__c');
        row.SFIBA_Device_Specialdemands__c = flag(tag, 'FSLEH_Special_Demands__c');
        row.SFIBA_Device_Property_Envrelevant__c = flag(tag, 'FSLEH_Environmental_Relevant__c');
        row.SFIBA_Device_Property_Safetyrelevant__c = flag(tag, 'FSLEH_Safety_Relevant__c');
        row.SFIBA_Device_Property_Qualityrelevant__c = flag(tag, 'FSLEH_Quality_Relevant__c');
    }

    private static void mapAsset(SFIBA_Row__c row, Map<String, Object> asset) {
        row.SFIBA_Device_Shortname__c = text(asset, 'Name');
        row.SFIBA_Supplier_Name__c = text(asset, 'Manufacturer_List__c');
        row.SFIBA_Device_Ordercode__c = text(asset, 'Order_Code__c');
        row.SFIBA_Device_Ordercode_Extended__c = text(asset, 'Order_Code_Extended__c');
        row.SFIBA_Device_Serialnumber__c = text(asset, 'SerialNumber');
        row.SFIBA_Devicetype_Spk__c = text(asset, 'Device_Type2__c');
        row.SFIBA_Devicetype_Label_Description__c = text(asset, 'deviceTypeValue');
        row.SFIBA_Device_Manufacturingdate__c = toDate(text(asset, 'Manufacturing_Date__c'));
        row.SFIBA_Device_Productstatus__c = text(asset, 'FSLEH_Product_Status_Formula__c');
    }

    private void noteUnknownValues(Map<String, Object> tag) {
        for (String field : PICKLISTS.keySet()) {
            String value = (String) tag.get(field);
            if (value != null && !PICKLISTS.get(field).contains(value.toLowerCase())) {
                unknown(field, value);
            }
        }
        String parameterType = (String) tag.get(PARAMETER_TYPE);
        if (
            String.isNotBlank(parameterType) &&
            !PARAMETER_TYPES.contains(parameterType.trim().toLowerCase())
        ) {
            unknown(PARAMETER_TYPE, parameterType);
        }
    }

    private void unknown(String field, String value) {
        if (!unknownValues.containsKey(field)) {
            unknownValues.put(field, new Set<String>());
        }
        unknownValues.get(field).add(value);
    }

    /** Text fields of the package hold at most 255 characters. */
    private static String text(Map<String, Object> parent, String field) {
        Object value = parent.get(field);
        return value == null ? null : String.valueOf(value).left(255);
    }

    /** The value in lower case if it is known, otherwise null (not set). */
    private static String picklist(Map<String, Object> parent, String field) {
        String value = (String) parent.get(field);
        if (value == null) {
            return null;
        }
        String lower = value.toLowerCase();
        return PICKLISTS.get(field).contains(lower) ? lower : null;
    }

    /** true/false or "Yes"/"No"; not sent counts as no, as in the report. */
    private static Boolean flag(Map<String, Object> parent, String field) {
        Object value = parent.get(field);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        return 'Yes'.equals(value);
    }

    /** YYYY-MM-DD; anything else rejects the delivery. */
    @TestVisible
    private static Date toDate(String value) {
        if (String.isBlank(value)) {
            return null;
        }
        Date result;
        if (Pattern.matches('\\d{4}-\\d{2}-\\d{2}', value)) {
            List<String> parts = value.split('-');
            Integer year = Integer.valueOf(parts[0]);
            Integer month = Integer.valueOf(parts[1]);
            Integer day = Integer.valueOf(parts[2]);
            if (month >= 1 && month <= 12 && day >= 1 && day <= Date.daysInMonth(year, month)) {
                result = Date.newInstance(year, month, day);
            }
        }
        if (result == null) {
            throw new SfibaImport.ImportException(
                'Datum nicht lesbar in Manufacturing_Date__c: \'' +
                    value +
                    '\'. Erwartet JJJJ-MM-TT.'
            );
        }
        return result;
    }

    private static Integer toInteger(Object value) {
        return value == null ? null : Integer.valueOf(String.valueOf(value));
    }

    // --- Checking -------------------------------------------------------------------------

    /**
     * The rules of the schema. Each objection is "<location>: <what is wrong>", the location
     * as a JSON pointer, for example "/location/0/rows/5/tag/Id: does not match the pattern".
     */
    private class Checker {
        private final List<String> problems;

        public Checker(List<String> problems) {
            this.problems = problems;
        }

        public void root(Object value) {
            Map<String, Object> root = asObject('', value);
            if (root == null) {
                return;
            }
            onlyKeys('', root, ROOT_KEYS);
            required('', root, new List<String>{ 'transmission', 'account', 'location' });
            if (root.containsKey('transmission')) {
                transmission('/transmission', root.get('transmission'));
            }
            if (root.containsKey('account')) {
                account('/account', root.get('account'));
            }
            if (root.containsKey('location')) {
                List<Object> locations = asArray('/location', root.get('location'));
                if (locations != null) {
                    for (Integer i = 0; i < locations.size(); i++) {
                        location('/location/' + i, locations[i]);
                    }
                }
            }
            if (root.containsKey('unassignedAssets')) {
                List<Object> assets = asArray('/unassignedAssets', root.get('unassignedAssets'));
                if (assets != null) {
                    for (Integer i = 0; i < assets.size(); i++) {
                        asset('/unassignedAssets/' + i, assets[i]);
                    }
                }
            }
        }

        void transmission(String at, Object value) {
            Map<String, Object> transmission = asObject(at, value);
            if (transmission == null) {
                return;
            }
            onlyKeys(at, transmission, TRANSMISSION_KEYS);
            required(at, transmission, new List<String>{ 'id', 'part', 'partCount' });
            if (transmission.containsKey('id')) {
                String transmissionId = asString(at + '/id', transmission.get('id'));
                if (
                    transmissionId != null &&
                    (transmissionId.length() < 1 ||
                    transmissionId.length() > 64)
                ) {
                    problem(at + '/id', 'must be 1 to 64 characters long');
                }
            }
            Integer part = transmission.containsKey('part')
                ? positiveInteger(at + '/part', transmission.get('part'))
                : null;
            Integer partCount = transmission.containsKey('partCount')
                ? positiveInteger(at + '/partCount', transmission.get('partCount'))
                : null;
            if (part != null && partCount != null && part > partCount) {
                problem(at + '/part', 'must not be greater than partCount');
            }
            if (transmission.containsKey('sentAt')) {
                asString(at + '/sentAt', transmission.get('sentAt'));
            }
            Object language = transmission.get('language');
            if (language != null) {
                String text = asString(at + '/language', language);
                if (text != null && !Pattern.matches('[a-z]{2}_[A-Z]{2}', text)) {
                    problem(at + '/language', 'does not match the pattern ^[a-z]{2}_[A-Z]{2}$');
                }
            }
            Object finalReport = transmission.get('isFinalReport');
            if (finalReport != null && !(finalReport instanceof Boolean)) {
                problem(at + '/isFinalReport', 'must be a boolean or null');
            }
        }

        void account(String at, Object value) {
            Map<String, Object> account = asObject(at, value);
            if (account == null) {
                return;
            }
            required(at, account, new List<String>{ 'Id', 'Name' });
            if (account.containsKey('Id')) {
                checkId(at + '/Id', account.get('Id'));
            }
            if (account.containsKey('Name')) {
                String name = asString(at + '/Name', account.get('Name'));
                if (name != null && name.length() < 1) {
                    problem(at + '/Name', 'must not be empty');
                }
            }
            if (account.containsKey('BillingCountryCode')) {
                asString(at + '/BillingCountryCode', account.get('BillingCountryCode'));
            }
        }

        void location(String at, Object value) {
            Map<String, Object> location = asObject(at, value);
            if (location == null) {
                return;
            }
            required(at, location, new List<String>{ 'Id', 'Name', 'rows' });
            if (location.containsKey('Id')) {
                checkId(at + '/Id', location.get('Id'));
            }
            if (location.containsKey('Name')) {
                asString(at + '/Name', location.get('Name'));
            }
            optionalString(at + '/ParentLocationId', location.get('ParentLocationId'));
            Object level = location.get('LocationLevel');
            if (level != null) {
                positiveInteger(at + '/LocationLevel', level);
            }
            if (location.containsKey('rows')) {
                List<Object> rows = asArray(at + '/rows', location.get('rows'));
                if (rows != null) {
                    for (Integer i = 0; i < rows.size(); i++) {
                        row(at + '/rows/' + i, rows[i]);
                    }
                }
            }
        }

        void row(String at, Object value) {
            Map<String, Object> row = asObject(at, value);
            if (row == null) {
                return;
            }
            onlyKeys(at, row, ROW_KEYS);
            required(at, row, new List<String>{ 'tag', 'asset' });
            if (row.containsKey('tag')) {
                tag(at + '/tag', row.get('tag'));
            }
            if (row.get('asset') != null) {
                asset(at + '/asset', row.get('asset'));
            }
        }

        void tag(String at, Object value) {
            Map<String, Object> tag = asObject(at, value);
            if (tag == null) {
                return;
            }
            required(at, tag, new List<String>{ 'Id', 'Name' });
            if (tag.containsKey('Id')) {
                checkId(at + '/Id', tag.get('Id'));
            }
            if (tag.containsKey('Name')) {
                asString(at + '/Name', tag.get('Name'));
            }
            for (String field : TAG_TEXT_FIELDS) {
                optionalString(at + '/' + field, tag.get(field));
            }
            for (String field : YES_NO_FIELDS) {
                Object flag = tag.get(field);
                if (
                    flag != null &&
                    !(flag instanceof Boolean) &&
                    !'Yes'.equals(flag) &&
                    !'No'.equals(flag)
                ) {
                    problem(at + '/' + field, 'must be one of true, false, "Yes", "No", null');
                }
            }
            Object child = tag.get('FSLEH_IsChildTAG__c');
            if (child != null && !(child instanceof Boolean)) {
                problem(at + '/FSLEH_IsChildTAG__c', 'must be a boolean or null');
            }
        }

        void asset(String at, Object value) {
            Map<String, Object> asset = asObject(at, value);
            if (asset == null) {
                return;
            }
            required(at, asset, new List<String>{ 'Id' });
            if (asset.containsKey('Id')) {
                checkId(at + '/Id', asset.get('Id'));
            }
            for (String field : ASSET_TEXT_FIELDS) {
                optionalString(at + '/' + field, asset.get(field));
            }
        }

        // --- single values ---

        Map<String, Object> asObject(String at, Object value) {
            if (value instanceof Map<String, Object>) {
                return (Map<String, Object>) value;
            }
            problem(at, 'must be an object');
            return null;
        }

        List<Object> asArray(String at, Object value) {
            if (value instanceof List<Object>) {
                return (List<Object>) value;
            }
            problem(at, 'must be an array');
            return null;
        }

        String asString(String at, Object value) {
            if (value instanceof String) {
                return (String) value;
            }
            problem(at, 'must be a string');
            return null;
        }

        void optionalString(String at, Object value) {
            if (value != null && !(value instanceof String)) {
                problem(at, 'must be a string or null');
            }
        }

        void checkId(String at, Object value) {
            String text = asString(at, value);
            if (text != null && !Pattern.matches(ID_PATTERN, text)) {
                problem(at, 'does not match the pattern ^[a-zA-Z0-9]{15,18}$');
            }
        }

        Integer positiveInteger(String at, Object value) {
            if (!(value instanceof Integer) && !(value instanceof Long)) {
                problem(at, 'must be an integer');
                return null;
            }
            Long whole;
            if (value instanceof Integer) {
                whole = (Integer) value;
            } else {
                whole = (Long) value;
            }
            if (whole < 1) {
                problem(at, 'must have a minimum value of 1');
                return null;
            }
            if (whole > 2147483647L) {
                problem(at, 'is too large');
                return null;
            }
            return whole.intValue();
        }

        void required(String at, Map<String, Object> value, List<String> keys) {
            for (String key : keys) {
                if (!value.containsKey(key)) {
                    problem(at, 'required property \'' + key + '\' not found');
                }
            }
        }

        void onlyKeys(String at, Map<String, Object> value, Set<String> allowed) {
            for (String key : value.keySet()) {
                if (!allowed.contains(key)) {
                    problem(at, 'property \'' + key + '\' is not defined in the schema');
                }
            }
        }

        void problem(String at, String message) {
            problems.add((String.isEmpty(at) ? '/' : at) + ': ' + message);
        }
    }
}
