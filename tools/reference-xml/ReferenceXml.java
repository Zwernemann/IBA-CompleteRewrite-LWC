import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.maz.eh.iba.core.account.IbaUser;
import de.maz.eh.iba.core.assets.DeviceData;
import de.maz.eh.iba.core.assets.DeviceRow;
import de.maz.eh.iba.core.assets.IntervalData;
import de.maz.eh.iba.core.report.*;
import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.Marshaller;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;

/** Writes the report XML of an input file with the code of IBA-Salesforce: raw and fine tuned. */
public class ReferenceXml {
    public static void main(String[] args) throws Exception {
        ObjectMapper json = new ObjectMapper();
        ObjectMapper fields = new ObjectMapper().setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.NONE)
                .setVisibility(PropertyAccessor.FIELD, JsonAutoDetect.Visibility.ANY)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        JsonNode input = json.readTree(Files.readString(Path.of(args[0])));
        String accountId = input.get("accountId").asText();
        List<IntervalData> intervals = new ArrayList<>();
        for (JsonNode node : input.get("intervals")) {
            intervals.add(fill(new IntervalData(), node));
        }
        List<DeviceData> devices = new ArrayList<>();
        for (JsonNode node : input.get("rows")) {
            DeviceRow row = new DeviceRow(accountId, text(node, "tag_id"), text(node, "asset_id"));
            row.deviceOid = node.get("device_oid").asLong();
            row.deviceTag = text(node, "device_tag");
            row.deviceMeasuringtask = text(node, "device_measuringtask");
            row.locationName = text(node, "location_name");
            row.deviceCriticality = text(node, "device_criticality");
            row.deviceAccessibility = text(node, "device_accessibility");
            row.deviceMaintEffectivness = text(node, "device_maint_effectivness");
            row.deviceConditions = text(node, "device_conditions");
            row.deviceSpecialdemands = bool(node, "device_specialdemands");
            row.devicePropertyEnvrelevant = bool(node, "device_property_envrelevant");
            row.devicePropertySafetyrelevant = bool(node, "device_property_safetyrelevant");
            row.devicePropertyQualityrelevant = bool(node, "device_property_qualityrelevant");
            row.deviceShortname = text(node, "device_shortname");
            row.supplierName = text(node, "supplier_name");
            row.deviceOrdercode = text(node, "device_ordercode");
            row.deviceSerialnumber = text(node, "device_serialnumber");
            row.devicetypeSpk = text(node, "devicetype_spk");
            row.devicetypeLabelDescription = text(node, "devicetype_label_description");
            String date = text(node, "device_manufacturingdate");
            row.deviceManufacturingdate = date == null ? null : LocalDate.parse(date);
            row.deviceProductstatus = text(node, "device_productstatus");
            row.addOrdercodeTransform = text(node, "add_ordercode_transform");
            row.addRecomendOrdercode = text(node, "add_recomend_ordercode");
            row.addAmountSpare = text(node, "add_amount_spare");
            row.addRemark1 = text(node, "add_remark1");
            row.addRemark2 = text(node, "add_remark2");
            row.addRemark3 = text(node, "add_remark3");
            JsonNode price = node.get("add_nu_price");
            row.addNuPrice = price == null || price.isNull() ? null : new BigDecimal(price.asText());
            row.recoInspInterval = text(node, "reco_insp_interval");
            row.recoCalibInterval = text(node, "reco_calib_interval");
            row.recoValidInterval = text(node, "reco_valid_interval");
            row.deviceRiskofmaint = text(node, "device_riskofmaint");
            row.deviceObsolence = text(node, "device_obsolence");
            DeviceData data = DeviceDataMapper.toDeviceData(row);
            String activities = text(node, "device_activities");
            if (activities != null) {
                data.setActivities(activities);
            }
            devices.add(data);
        }
        IbaSiteValues site = fill(new IbaSiteValues(), input.get("sitevalue"));
        site.convertImplementationTimeline();
        ReportXmlFields.complete(devices, accountId, site.getSiteName(), intervals);

        IbaXmlLayout layout = new IbaXmlLayout();
        layout.setTheDeviceData(devices);
        layout.setTheSiteValues(site);
        layout.setTheUser(fill(new IbaUser(), input.get("user")));
        layout.setTheInterval(intervals);
        layout.setTheReportSettings(fill(new IbaReportSettings(), input.get("reportsettings")));

        StringWriter raw = new StringWriter();
        Marshaller marshaller = JAXBContext.newInstance(IbaXmlLayout.class).createMarshaller();
        marshaller.setProperty(Marshaller.JAXB_FORMATTED_OUTPUT, Boolean.TRUE);
        marshaller.marshal(layout, raw);
        Files.writeString(Path.of(args[1]), raw.toString(), StandardCharsets.UTF_8);
        StringWriter tuned = new StringWriter();
        try (FineTuneWriter writer = new FineTuneWriter(tuned)) {
            writer.write(raw.toString());
        }
        Files.writeString(Path.of(args[2]), tuned.toString(), StandardCharsets.UTF_8);
    }

    /** Sets the fields of an object from JSON keyed by their XML element names. */
    static <T> T fill(T target, JsonNode node) throws Exception {
        for (java.lang.reflect.Field field : target.getClass().getDeclaredFields()) {
            if (java.lang.reflect.Modifier.isStatic(field.getModifiers())) continue;
            jakarta.xml.bind.annotation.XmlElement element = field.getAnnotation(jakarta.xml.bind.annotation.XmlElement.class);
            String name = element != null && !"##default".equals(element.name()) ? element.name() : field.getName();
            JsonNode value = node.get(name);
            if (value == null) continue;
            field.setAccessible(true);
            Class<?> type = field.getType();
            Object converted;
            if (value.isNull()) converted = null;
            else if (type == String.class) converted = value.asText();
            else if (type == int.class || type == Integer.class) converted = value.asInt();
            else if (type == long.class || type == Long.class) converted = value.asLong();
            else if (type == boolean.class || type == Boolean.class) converted = value.asBoolean();
            else throw new IllegalStateException("type " + type + " of " + name);
            if (converted == null && type.isPrimitive()) continue;
            field.set(target, converted);
        }
        return target;
    }

    static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    static Boolean bool(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asBoolean();
    }
}
