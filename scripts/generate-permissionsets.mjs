#!/usr/bin/env node
// Writes the permission sets of the package from the object definitions, so that a new field
// cannot be forgotten in them. Run after adding or removing a field; the CI fails when the
// committed permission sets differ from what this script writes (--check).
//
//   node scripts/generate-permissionsets.mjs          write
//   node scripts/generate-permissionsets.mjs --check  only compare

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const objectsDir = join(root, "force-app/main/default/objects");
const targetDir = join(root, "force-app/main/default/permissionsets");

// Per permission set: object rights, and which fields of an object may be edited.
// "all" means every field the platform lets a permission set grant.
const SETS = {
    DIBA_Report_Consultant: {
        label: "DIBA Report Consultant",
        description:
            "Consultants who open the DIBA Report Generator on an account: read the plant data, enter their input, edit report texts and settings.",
        objects: {
            DIBA_Account__c: { read: true, edit: true },
            DIBA_Row__c: {
                read: true,
                edit: true,
                editableFields: [
                    "Add_Ordercode_Transform__c",
                    "Add_Recomend_Ordercode__c",
                    "Add_Amount_Spare__c",
                    "Add_Remark1__c",
                    "Add_Remark2__c",
                    "Add_Remark3__c",
                    "Add_Nu_Price__c",
                    "Reco_Insp_Interval__c",
                    "Reco_Calib_Interval__c",
                    "Reco_Valid_Interval__c",
                    "Device_Riskofmaint__c",
                    "Device_Obsolence__c",
                    "Device_Insp_Interval__c",
                    "Device_Calib_Interval__c",
                    "Device_Valid_Interval__c",
                    "Version__c",
                    "Consultant_Updated_At__c",
                ],
            },
            DIBA_Transmission__c: { read: true },
            DIBA_Report_Value__c: { read: true, create: true, edit: true, delete: true, editableFields: "all" },
            DIBA_Master_Edit__c: { read: true, create: true, edit: true, delete: true, editableFields: "all" },
            DIBA_Interval_Value__c: { read: true, create: true, edit: true, delete: true, editableFields: "all" },
        },
        customMetadataTypes: ["DIBA_Interval__mdt"],
        classes: [],
    },
    DIBA_Data_Sender: {
        label: "DIBA Data Sender",
        description:
            "The user under whom E+H's action delivers plant data to mzw.DibaImport.",
        objects: {
            DIBA_Account__c: { read: true, create: true, edit: true, editableFields: "all" },
            DIBA_Row__c: { read: true, create: true, edit: true, editableFields: "all" },
            DIBA_Transmission__c: { read: true, create: true, edit: true, editableFields: "all" },
        },
        customMetadataTypes: [],
        classes: ["DibaImport"],
    },
};

/** Fields a permission set can carry: not required, not master-detail, not auto number. */
function grantableFields(object) {
    const dir = join(objectsDir, object, "fields");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((file) => file.endsWith(".field-meta.xml"))
        .map((file) => ({ name: file.replace(".field-meta.xml", ""), xml: readFileSync(join(dir, file), "utf8") }))
        .filter(({ xml }) => !/<required>true<\/required>/.test(xml))
        .filter(({ xml }) => !/<type>(MasterDetail|AutoNumber)<\/type>/.test(xml))
        .map(({ name, xml }) => ({ name, formula: /<formula>/.test(xml) }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function render(name, set) {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">'];
    for (const cls of set.classes) {
        lines.push("    <classAccesses>", `        <apexClass>${cls}</apexClass>`, "        <enabled>true</enabled>", "    </classAccesses>");
    }
    for (const type of set.customMetadataTypes) {
        lines.push("    <customMetadataTypeAccesses>", "        <enabled>true</enabled>", `        <name>${type}</name>`, "    </customMetadataTypeAccesses>");
    }
    lines.push(`    <description>${set.description}</description>`);
    const objects = Object.keys(set.objects).sort();
    for (const object of objects) {
        const rights = set.objects[object];
        for (const field of grantableFields(object)) {
            const editable =
                !field.formula && (rights.editableFields === "all" || (rights.editableFields ?? []).includes(field.name));
            lines.push(
                "    <fieldPermissions>",
                `        <editable>${editable}</editable>`,
                `        <field>${object}.${field.name}</field>`,
                "        <readable>true</readable>",
                "    </fieldPermissions>",
            );
        }
    }
    lines.push("    <hasActivationRequired>false</hasActivationRequired>", `    <label>${set.label}</label>`);
    for (const object of objects) {
        const r = set.objects[object];
        lines.push(
            "    <objectPermissions>",
            `        <allowCreate>${!!r.create}</allowCreate>`,
            `        <allowDelete>${!!r.delete}</allowDelete>`,
            `        <allowEdit>${!!r.edit}</allowEdit>`,
            `        <allowRead>${!!r.read}</allowRead>`,
            "        <modifyAllRecords>false</modifyAllRecords>",
            `        <object>${object}</object>`,
            "        <viewAllRecords>false</viewAllRecords>",
            "    </objectPermissions>",
        );
    }
    lines.push("</PermissionSet>", "");
    return lines.join("\n");
}

const check = process.argv.includes("--check");
let stale = [];
for (const [name, set] of Object.entries(SETS)) {
    const file = join(targetDir, `${name}.permissionset-meta.xml`);
    const content = render(name, set);
    if (check) {
        if (!existsSync(file) || readFileSync(file, "utf8") !== content) stale.push(file);
    } else {
        writeFileSync(file, content);
    }
}
if (stale.length) {
    console.error("Permission Sets passen nicht zu den Objekten. Neu erzeugen mit:");
    console.error("  node scripts/generate-permissionsets.mjs");
    for (const file of stale) console.error("  veraltet: " + file);
    process.exit(1);
}
