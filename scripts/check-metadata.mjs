#!/usr/bin/env node
// Checks the metadata of the packages for what Salesforce would only reject when a package
// version is built, minutes later: element order of fields, lengths of names and labels.
// Exits with 1 and names every finding.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const findings = [];

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

const files = ["force-app", "eh-emulation"].flatMap((dir) => walk(join(root, dir)));

for (const file of files.filter((f) => f.endsWith(".field-meta.xml"))) {
    const xml = readFileSync(file, "utf8");
    const where = relative(root, file);
    // Top level elements must follow the order of the schema: fullName, then alphabetical.
    const elements = [...xml.matchAll(/^ {4}<(\w+)>/gm)].map((m) => m[1]);
    const rest = elements.filter((e) => e !== "fullName");
    const sorted = [...rest].sort();
    if (elements[0] !== "fullName" || rest.join() !== sorted.join()) {
        findings.push(`${where}: Elemente nicht in der Reihenfolge fullName, dann alphabetisch`);
    }
    const name = (xml.match(/<fullName>([^<]+)<\/fullName>/) || [])[1] || "";
    if (name.length > 40) findings.push(`${where}: API-Name laenger als 40 Zeichen`);
    const label = (xml.match(/<label>([^<]+)<\/label>/) || [])[1] || "";
    if (label.length > 40) findings.push(`${where}: Label laenger als 40 Zeichen`);
    const description = (xml.match(/<description>([^<]*)<\/description>/) || [])[1] || "";
    if (description.length > 1000) findings.push(`${where}: Beschreibung laenger als 1000 Zeichen`);
    const type = (xml.match(/<type>([^<]+)<\/type>/) || [])[1];
    const length = Number((xml.match(/<length>(\d+)<\/length>/) || [])[1]);
    if (type === "Text" && length > 255) findings.push(`${where}: Text laenger als 255`);
    if (!/<description>/.test(xml)) findings.push(`${where}: Beschreibung fehlt`);
}

for (const file of files.filter((f) => f.endsWith(".object-meta.xml"))) {
    const xml = readFileSync(file, "utf8");
    const label = (xml.match(/^ {4}<label>([^<]+)<\/label>/m) || [])[1] || "";
    if (label.length > 40) findings.push(`${relative(root, file)}: Label laenger als 40 Zeichen`);
}

for (const file of files.filter((f) => f.endsWith(".md-meta.xml"))) {
    const label = (readFileSync(file, "utf8").match(/<label>([^<]*)<\/label>/) || [])[1] || "";
    if (label.length > 40) findings.push(`${relative(root, file)}: Label laenger als 40 Zeichen`);
}

if (findings.length) {
    for (const finding of findings) console.error(finding);
    process.exit(1);
}
console.log(`Metadaten in Ordnung (${files.length} Dateien).`);
