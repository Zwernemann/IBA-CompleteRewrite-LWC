/**
 * The fields of a row as the user interface and the report XML know them: by their element
 * name in the report XML (device_tag, add_remark1 ...), mapped onto the fields of
 * DIBA_Row__c. One place for the mapping, so that the components never see the API names,
 * which carry the namespace prefix in an org where the package is installed.
 */
public with sharing class DibaRowFields {
    /** Where a field comes from, which decides who may write it. */
    public enum Kind {
        KEY,
        MASTER,
        CONSULTANT,
        CALCULATED
    }

    public class Field {
        public final String name;
        public final Schema.SObjectField token;
        public final Kind kind;

        Field(String name, Schema.SObjectField token, Kind kind) {
            this.name = name;
            this.token = token;
            this.kind = kind;
        }
    }

    public static final List<Field> ALL = new List<Field>{
        new Field('device_oid', DIBA_Row__c.Name, Kind.KEY),
        new Field('row_key', DIBA_Row__c.Row_Key__c, Kind.KEY),
        new Field('tag_id', DIBA_Row__c.Tag_Id__c, Kind.KEY),
        new Field('asset_id', DIBA_Row__c.Asset_Id__c, Kind.KEY),
        new Field('version', DIBA_Row__c.Version__c, Kind.KEY),
        new Field('device_tag', DIBA_Row__c.Device_Tag__c, Kind.MASTER),
        new Field('device_measuringtask', DIBA_Row__c.Device_Measuringtask__c, Kind.MASTER),
        new Field('location_name', DIBA_Row__c.Location_Name__c, Kind.MASTER),
        new Field('device_criticality', DIBA_Row__c.Device_Criticality__c, Kind.MASTER),
        new Field('device_accessibility', DIBA_Row__c.Device_Accessibility__c, Kind.MASTER),
        new Field(
            'device_maint_effectivness',
            DIBA_Row__c.Device_Maint_Effectivness__c,
            Kind.MASTER
        ),
        new Field('device_conditions', DIBA_Row__c.Device_Conditions__c, Kind.MASTER),
        new Field('device_specialdemands', DIBA_Row__c.Device_Specialdemands__c, Kind.MASTER),
        new Field(
            'device_property_envrelevant',
            DIBA_Row__c.Device_Property_Envrelevant__c,
            Kind.MASTER
        ),
        new Field(
            'device_property_safetyrelevant',
            DIBA_Row__c.Device_Property_Safetyrelevant__c,
            Kind.MASTER
        ),
        new Field(
            'device_property_qualityrelevant',
            DIBA_Row__c.Device_Property_Qualityrelevant__c,
            Kind.MASTER
        ),
        new Field('device_shortname', DIBA_Row__c.Device_Shortname__c, Kind.MASTER),
        new Field('supplier_name', DIBA_Row__c.Supplier_Name__c, Kind.MASTER),
        new Field('device_ordercode', DIBA_Row__c.Device_Ordercode__c, Kind.MASTER),
        new Field(
            'device_ordercode_extended',
            DIBA_Row__c.Device_Ordercode_Extended__c,
            Kind.MASTER
        ),
        new Field('device_serialnumber', DIBA_Row__c.Device_Serialnumber__c, Kind.MASTER),
        new Field('devicetype_spk', DIBA_Row__c.Devicetype_Spk__c, Kind.MASTER),
        new Field(
            'devicetype_label_description',
            DIBA_Row__c.Devicetype_Label_Description__c,
            Kind.MASTER
        ),
        new Field('device_manufacturingdate', DIBA_Row__c.Device_Manufacturingdate__c, Kind.MASTER),
        new Field('device_productstatus', DIBA_Row__c.Device_Productstatus__c, Kind.MASTER),
        new Field(
            'add_ordercode_transform',
            DIBA_Row__c.Add_Ordercode_Transform__c,
            Kind.CONSULTANT
        ),
        new Field('add_recomend_ordercode', DIBA_Row__c.Add_Recomend_Ordercode__c, Kind.CONSULTANT),
        new Field('add_amount_spare', DIBA_Row__c.Add_Amount_Spare__c, Kind.CONSULTANT),
        new Field('add_remark1', DIBA_Row__c.Add_Remark1__c, Kind.CONSULTANT),
        new Field('add_remark2', DIBA_Row__c.Add_Remark2__c, Kind.CONSULTANT),
        new Field('add_remark3', DIBA_Row__c.Add_Remark3__c, Kind.CONSULTANT),
        new Field('add_nu_price', DIBA_Row__c.Add_Nu_Price__c, Kind.CONSULTANT),
        new Field('reco_insp_interval', DIBA_Row__c.Reco_Insp_Interval__c, Kind.CONSULTANT),
        new Field('reco_calib_interval', DIBA_Row__c.Reco_Calib_Interval__c, Kind.CONSULTANT),
        new Field('reco_valid_interval', DIBA_Row__c.Reco_Valid_Interval__c, Kind.CONSULTANT),
        new Field('device_riskofmaint', DIBA_Row__c.Device_Riskofmaint__c, Kind.CALCULATED),
        new Field('device_obsolence', DIBA_Row__c.Device_Obsolence__c, Kind.CALCULATED),
        new Field('device_insp_interval', DIBA_Row__c.Device_Insp_Interval__c, Kind.CALCULATED),
        new Field('device_calib_interval', DIBA_Row__c.Device_Calib_Interval__c, Kind.CALCULATED),
        new Field('device_valid_interval', DIBA_Row__c.Device_Valid_Interval__c, Kind.CALCULATED)
    };

    /**
     * Master fields the consultant may change beside the Salesforce value, stored as
     * DIBA_Master_Edit__c. device_activities exists only as such an edit; Salesforce does
     * not deliver it.
     */
    public static final Set<String> EDITABLE_MASTER = new Set<String>{
        'device_tag',
        'device_ordercode',
        'device_serialnumber',
        'device_shortname',
        'devicetype_spk',
        'device_manufacturingdate',
        'device_criticality',
        'device_conditions',
        'device_specialdemands',
        'device_accessibility',
        'device_maint_effectivness',
        'device_activities',
        'device_property_envrelevant',
        'device_property_safetyrelevant',
        'device_property_qualityrelevant'
    };

    private static Map<String, Field> byName;

    public static Field get(String name) {
        if (byName == null) {
            byName = new Map<String, Field>();
            for (Field field : ALL) {
                byName.put(field.name, field);
            }
        }
        return byName.get(name);
    }

    /** The field list of a query of rows, the master data edits as subquery. */
    public static String selectList() {
        List<String> names = new List<String>{ 'Id' };
        for (Field field : ALL) {
            names.add(String.valueOf(field.token));
        }
        names.add(
            '(SELECT Field__c, Value__c, Salesforce_Value__c FROM Master_Edits__r ORDER BY Field__c)'
        );
        return String.join(names, ', ');
    }

    /**
     * A row for the user interface: element names as keys, dates as YYYY-MM-DD, switches as
     * true/false, the master data edits under "edits" as stored. Applying them is the
     * client's work (dibaRowLogic), as the rules belong to the table.
     */
    public static Map<String, Object> toMap(DIBA_Row__c row) {
        Map<String, Object> result = new Map<String, Object>{ 'id' => row.Id };
        for (Field field : ALL) {
            Object value = row.get(field.token);
            if (value instanceof Date) {
                value = String.valueOf((Date) value);
            }
            result.put(field.name, value);
        }
        result.put('version', row.Version__c == null ? 0 : row.Version__c.intValue());
        List<Map<String, Object>> edits = new List<Map<String, Object>>();
        for (DIBA_Master_Edit__c edit : row.Master_Edits__r) {
            edits.add(
                new Map<String, Object>{
                    'field' => edit.Field__c,
                    'value' => edit.Value__c,
                    'salesforceValue' => edit.Salesforce_Value__c
                }
            );
        }
        result.put('edits', edits);
        return result;
    }

    /** Converts a value of the user interface for the field; throws on a bad value. */
    public static Object fromClient(Field field, Object value) {
        if (value == null || (value instanceof String && String.isBlank((String) value))) {
            Schema.DisplayType type = field.token.getDescribe().getType();
            return type == Schema.DisplayType.BOOLEAN ? (Object) false : null;
        }
        Schema.DisplayType type = field.token.getDescribe().getType();
        if (type == Schema.DisplayType.DATE) {
            return Date.valueOf(String.valueOf(value));
        }
        if (type == Schema.DisplayType.BOOLEAN) {
            return value instanceof Boolean ? value : Boolean.valueOf(String.valueOf(value));
        }
        if (type == Schema.DisplayType.DOUBLE || type == Schema.DisplayType.CURRENCY) {
            return Decimal.valueOf(String.valueOf(value));
        }
        String text = String.valueOf(value);
        Integer length = field.token.getDescribe().getLength();
        if (length > 0 && text.length() > length) {
            throw new IllegalArgumentException(
                field.name +
                    ' is limited to ' +
                    length +
                    ' characters, the entry has ' +
                    text.length() +
                    '.'
            );
        }
        return text;
    }
}
