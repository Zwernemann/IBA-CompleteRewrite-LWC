/**
 * The fields of a row as the user interface and the report XML know them: by their element
 * name in the report XML (device_tag, add_remark1 ...), mapped onto the fields of
 * SFIBA_Row__c. One place for the mapping, so that the components never see the API names,
 * which carry the namespace prefix in an org where the package is installed.
 */
public with sharing class SfibaRowFields {
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
        new Field('device_oid', SFIBA_Row__c.Name, Kind.KEY),
        new Field('row_key', SFIBA_Row__c.SFIBA_Row_Key__c, Kind.KEY),
        new Field('tag_id', SFIBA_Row__c.SFIBA_Tag_Id__c, Kind.KEY),
        new Field('asset_id', SFIBA_Row__c.SFIBA_Asset_Id__c, Kind.KEY),
        new Field('version', SFIBA_Row__c.SFIBA_Version__c, Kind.KEY),
        new Field('order_code_pending', SFIBA_Row__c.SFIBA_Order_Code_Pending__c, Kind.KEY),
        new Field('device_tag', SFIBA_Row__c.SFIBA_Device_Tag__c, Kind.MASTER),
        new Field('device_measuringtask', SFIBA_Row__c.SFIBA_Device_Measuringtask__c, Kind.MASTER),
        new Field('location_name', SFIBA_Row__c.SFIBA_Location_Name__c, Kind.MASTER),
        new Field('device_criticality', SFIBA_Row__c.SFIBA_Device_Criticality__c, Kind.MASTER),
        new Field('device_accessibility', SFIBA_Row__c.SFIBA_Device_Accessibility__c, Kind.MASTER),
        new Field(
            'device_maint_effectivness',
            SFIBA_Row__c.SFIBA_Device_Maint_Effectivness__c,
            Kind.MASTER
        ),
        new Field('device_conditions', SFIBA_Row__c.SFIBA_Device_Conditions__c, Kind.MASTER),
        new Field(
            'device_specialdemands',
            SFIBA_Row__c.SFIBA_Device_Specialdemands__c,
            Kind.MASTER
        ),
        new Field(
            'device_property_envrelevant',
            SFIBA_Row__c.SFIBA_Device_Property_Envrelevant__c,
            Kind.MASTER
        ),
        new Field(
            'device_property_safetyrelevant',
            SFIBA_Row__c.SFIBA_Device_Property_Safetyrelevant__c,
            Kind.MASTER
        ),
        new Field(
            'device_property_qualityrelevant',
            SFIBA_Row__c.SFIBA_Device_Property_Qualityrelevant__c,
            Kind.MASTER
        ),
        new Field('device_shortname', SFIBA_Row__c.SFIBA_Device_Shortname__c, Kind.MASTER),
        new Field('supplier_name', SFIBA_Row__c.SFIBA_Supplier_Name__c, Kind.MASTER),
        new Field('device_ordercode', SFIBA_Row__c.SFIBA_Device_Ordercode__c, Kind.MASTER),
        new Field(
            'device_ordercode_extended',
            SFIBA_Row__c.SFIBA_Device_Ordercode_Extended__c,
            Kind.MASTER
        ),
        new Field('device_serialnumber', SFIBA_Row__c.SFIBA_Device_Serialnumber__c, Kind.MASTER),
        new Field('devicetype_spk', SFIBA_Row__c.SFIBA_Devicetype_Spk__c, Kind.MASTER),
        new Field(
            'devicetype_label_description',
            SFIBA_Row__c.SFIBA_Devicetype_Label_Description__c,
            Kind.MASTER
        ),
        new Field(
            'device_manufacturingdate',
            SFIBA_Row__c.SFIBA_Device_Manufacturingdate__c,
            Kind.MASTER
        ),
        new Field('device_productstatus', SFIBA_Row__c.SFIBA_Device_Productstatus__c, Kind.MASTER),
        new Field(
            'add_ordercode_transform',
            SFIBA_Row__c.SFIBA_Add_Ordercode_Transform__c,
            Kind.CONSULTANT
        ),
        new Field(
            'add_recomend_ordercode',
            SFIBA_Row__c.SFIBA_Add_Recomend_Ordercode__c,
            Kind.CONSULTANT
        ),
        new Field('add_amount_spare', SFIBA_Row__c.SFIBA_Add_Amount_Spare__c, Kind.CONSULTANT),
        new Field('add_remark1', SFIBA_Row__c.SFIBA_Add_Remark1__c, Kind.CONSULTANT),
        new Field('add_remark2', SFIBA_Row__c.SFIBA_Add_Remark2__c, Kind.CONSULTANT),
        new Field('add_remark3', SFIBA_Row__c.SFIBA_Add_Remark3__c, Kind.CONSULTANT),
        new Field('add_nu_price', SFIBA_Row__c.SFIBA_Add_Nu_Price__c, Kind.CONSULTANT),
        new Field('reco_insp_interval', SFIBA_Row__c.SFIBA_Reco_Insp_Interval__c, Kind.CONSULTANT),
        new Field(
            'reco_calib_interval',
            SFIBA_Row__c.SFIBA_Reco_Calib_Interval__c,
            Kind.CONSULTANT
        ),
        new Field(
            'reco_valid_interval',
            SFIBA_Row__c.SFIBA_Reco_Valid_Interval__c,
            Kind.CONSULTANT
        ),
        new Field('device_riskofmaint', SFIBA_Row__c.SFIBA_Device_Riskofmaint__c, Kind.CALCULATED),
        new Field('device_obsolence', SFIBA_Row__c.SFIBA_Device_Obsolence__c, Kind.CALCULATED),
        new Field(
            'device_insp_interval',
            SFIBA_Row__c.SFIBA_Device_Insp_Interval__c,
            Kind.CALCULATED
        ),
        new Field(
            'device_calib_interval',
            SFIBA_Row__c.SFIBA_Device_Calib_Interval__c,
            Kind.CALCULATED
        ),
        new Field(
            'device_valid_interval',
            SFIBA_Row__c.SFIBA_Device_Valid_Interval__c,
            Kind.CALCULATED
        )
    };

    /**
     * Master fields the consultant may change beside the Salesforce value, stored as
     * SFIBA_Master_Edit__c. device_activities exists only as such an edit; Salesforce does
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
            '(SELECT SFIBA_Field__c, SFIBA_Value__c, SFIBA_Salesforce_Value__c FROM SFIBA_Master_Edits__r ORDER BY SFIBA_Field__c)'
        );
        return String.join(names, ', ');
    }

    /**
     * A row for the user interface: element names as keys, dates as YYYY-MM-DD, switches as
     * true/false, the master data edits under "edits" as stored. Applying them is the
     * client's work (sfibaRowLogic), as the rules belong to the table.
     */
    public static Map<String, Object> toMap(SFIBA_Row__c row) {
        Map<String, Object> result = new Map<String, Object>{ 'id' => row.Id };
        for (Field field : ALL) {
            Object value = row.get(field.token);
            if (value instanceof Date) {
                value = String.valueOf((Date) value);
            }
            result.put(field.name, value);
        }
        result.put('version', row.SFIBA_Version__c == null ? 0 : row.SFIBA_Version__c.intValue());
        List<Map<String, Object>> edits = new List<Map<String, Object>>();
        for (SFIBA_Master_Edit__c edit : row.SFIBA_Master_Edits__r) {
            edits.add(
                new Map<String, Object>{
                    'field' => edit.SFIBA_Field__c,
                    'value' => edit.SFIBA_Value__c,
                    'salesforceValue' => edit.SFIBA_Salesforce_Value__c
                }
            );
        }
        result.put('edits', edits);
        return result;
    }

    /** Converts a value of the user interface for the field; throws on a bad value. */
    public static Object fromClient(Field field, Object value) {
        if (value == null || (value instanceof String && String.isBlank((String) value))) {
            Schema.DisplayType kind = field.token.getDescribe().getType();
            return kind == Schema.DisplayType.BOOLEAN ? (Object) false : null;
        }
        Schema.DisplayType kind = field.token.getDescribe().getType();
        if (kind == Schema.DisplayType.DATE) {
            return Date.valueOf(String.valueOf(value));
        }
        if (kind == Schema.DisplayType.BOOLEAN) {
            return value instanceof Boolean ? value : Boolean.valueOf(String.valueOf(value));
        }
        if (kind == Schema.DisplayType.DOUBLE || kind == Schema.DisplayType.CURRENCY) {
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
