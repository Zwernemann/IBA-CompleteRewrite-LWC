/**
 * The columns of the four table dialogs of IBA-Salesforce (ibaMaintDialog, ibaBreakdownDialog,
 * ibaMigrationDialog, ibaPreventativeDialog), with what can be edited where. Labels come
 * from the translation library through t.
 */
import { isEndressHauser } from "c/sfibaRowLogic";

const option = (value, label) => ({ value, label: label === undefined ? value : label });

const CRITICALITY = [option("low"), option("medium"), option("high"), option("notset")];
const CONDITIONS = [option("normal"), option("heavy"), option("notset")];
const ACCESSIBILITY = [option("easy"), option("moderate"), option("difficult"), option("", "notset")];
const EFFECTIVENESS = [option("low"), option("medium"), option("high")];
const ACTIVITIES = [option("yes"), option("no"), option("", "notset")];
const YES_NO = [option("true", "Yes"), option("false", "No")];
const RISK = [option("low"), option("normal"), option("high"), option("notset")];
const OBSOLESCENCE = [option("low"), option("medium"), option("high"), option("notset")];

const always = () => true;
const notEndressHauser = (row) => !isEndressHauser(row);

/** The dialogs, by name; each with the translation key of its title. */
export const VIEWS = {
    maintenance: "crgen.fr.edit.asset.tab",
    breakdown: "crgen.fr.edit.ext.spare.inst.tab",
    migration: "crgen.fr.edit.ext.tab",
    preventative: "crgen.fr.edit.prev.maint.tab"
};

function column(t, key, field, width, extra = {}) {
    return { field, label: t(key), width, ...extra };
}

/**
 * The columns of a dialog.
 * @param view one of the keys of VIEWS
 * @param t    translation function key -> text
 */
export function columnsFor(view, t) {
    const c = (key, field, width, extra) => column(t, key, field, width, extra);
    const price = c("crgen.fr.budgetprice", "add_nu_price", 120, { type: "number", editable: always });
    switch (view) {
        case "breakdown":
            return [
                c("crgen.fr.tag", "device_tag", 140),
                c("crgen.fr.manufacturer", "supplier_name", 130),
                c("crgen.fr.asset.type", "devicetype_label_description", 150),
                c("crgen.fr.measuring.task", "device_measuringtask", 120),
                c("crgen.fr.serialnumber", "device_serialnumber", 130),
                c("crgen.fr.ordercode", "device_ordercode", 170),
                c("crgen.fr.location", "location_name", 180),
                c("crgen.fr.risk.of.maintainability", "device_riskofmaint", 120, { type: "select", options: RISK }),
                c("crgen.fr.criticality", "device_criticality", 100, { type: "select", options: CRITICALITY }),
                c("crgen.fr.spareinst", "add_ordercode_transform", 170),
                c("crgen.fr.spareinst.rec", "add_recomend_ordercode", 170, { editable: always }),
                c("crgen.fr.spareinst.rec.amount", "add_amount_spare", 120, { editable: always }),
                c("crgen.fr.remark", "add_remark1", 220, { editable: always }),
                price
            ];
        case "migration":
            return [
                c("crgen.fr.tag", "device_tag", 140),
                c("crgen.fr.criticality", "device_criticality", 100, { type: "select", options: CRITICALITY }),
                c("crgen.fr.risk.of.maintainability", "device_riskofmaint", 120, { type: "select", options: RISK }),
                c("crgen.fr.manufacturer", "supplier_name", 130),
                c("crgen.fr.asset.type", "devicetype_label_description", 150),
                c("crgen.fr.measuring.task", "device_measuringtask", 120),
                c("crgen.fr.serialnumber", "device_serialnumber", 130),
                c("crgen.fr.location", "location_name", 180),
                c("crgen.fr.ordercode", "device_ordercode", 170),
                c("crgen.fr.successor", "add_ordercode_transform", 170),
                c("crgen.fr.recom.order", "add_recomend_ordercode", 170, { editable: always }),
                c("crgen.fr.remark", "add_remark2", 220, { editable: always }),
                price
            ];
        case "preventative":
            return [
                c("crgen.fr.tag", "device_tag", 140),
                c("crgen.fr.serialnumber", "device_serialnumber", 130),
                c("crgen.fr.ordercode", "device_ordercode", 170),
                c("crgen.fr.asset.type", "devicetype_label_description", 150),
                c("crgen.fr.measuring.task", "device_measuringtask", 120),
                c("crgen.fr.location", "location_name", 180),
                c("crgen.fr.quality.related", "device_property_qualityrelevant", 100, { type: "checkbox", editable: always }),
                c("crgen.fr.env.related", "device_property_envrelevant", 100, { type: "checkbox", editable: always }),
                c("crgen.fr.safety.related", "device_property_safetyrelevant", 100, { type: "checkbox", editable: always }),
                c("crgen.fr.criticality", "device_criticality", 100, { type: "select", options: CRITICALITY }),
                c("crgen.fr.conditions", "device_conditions", 100, { type: "select", options: CONDITIONS }),
                c("crgen.fr.special.demands", "device_specialdemands", 100, { type: "select", options: YES_NO, editable: always }),
                c("crgen.fr.maint.interval", "device_insp_interval", 110),
                c("crgen.fr.calib.interval", "device_calib_interval", 110),
                c("crgen.fr.valid.interval", "device_valid_interval", 110),
                c("crgen.fr.recom.int.maint", "reco_insp_interval", 120, { editable: always }),
                c("crgen.fr.recom.int.calib", "reco_calib_interval", 120, { editable: always }),
                c("crgen.fr.recom.int.valid", "reco_valid_interval", 120, { editable: always }),
                c("crgen.fr.remark", "add_remark3", 220, { editable: always }),
                price
            ];
        default:
            return [
                c("crgen.fr.tag", "device_tag", 140, { editable: always }),
                c("crgen.fr.manufacturer", "supplier_name", 130),
                c("crgen.fr.ordercode", "device_ordercode", 170, { editable: notEndressHauser }),
                c("crgen.fr.serialnumber", "device_serialnumber", 130, { editable: notEndressHauser }),
                c("crgen.fr.productname", "device_shortname", 150, { editable: notEndressHauser }),
                c("crgen.fr.spk", "devicetype_spk", 60, { editable: notEndressHauser }),
                c("crgen.fr.measuring.task", "device_measuringtask", 120),
                c("crgen.fr.manufact.date", "device_manufacturingdate", 140, { type: "date", editable: notEndressHauser }),
                c("crgen.fr.criticality", "device_criticality", 110, { type: "select", options: CRITICALITY, editable: always }),
                c("crgen.fr.location", "location_name", 180),
                c("crgen.fr.risk.of.maintainability", "device_riskofmaint", 130, { type: "select", options: RISK }),
                c("crgen.fr.env.conditions", "device_conditions", 110, { type: "select", options: CONDITIONS, editable: always }),
                c("crgen.fr.special.demands", "device_specialdemands", 110, { type: "select", options: YES_NO, editable: always }),
                c("crgen.fr.env.related", "device_property_envrelevant", 110, { type: "checkbox", editable: always }),
                c("crgen.fr.safety.related", "device_property_safetyrelevant", 110, { type: "checkbox", editable: always }),
                c("crgen.fr.quality.related", "device_property_qualityrelevant", 110, { type: "checkbox", editable: always }),
                c("crgen.fr.product.status", "device_obsolence", 110, { type: "select", options: OBSOLESCENCE }),
                c("crgen.fr.accessibility", "device_accessibility", 120, { type: "select", options: ACCESSIBILITY, editable: always }),
                c("crgen.fr.maint.effectiveness", "device_maint_effectivness", 130, { type: "select", options: EFFECTIVENESS, editable: always }),
                c("crgen.fr.activities", "device_activities", 100, { type: "select", options: ACTIVITIES, editable: always })
            ];
    }
}
