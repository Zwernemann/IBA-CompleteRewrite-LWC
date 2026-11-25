#!/usr/bin/env node
// Finds names in Apex that the compiler refuses because they are reserved, such as a
// variable "number" or a class "Page". Apex does not tell upper from lower case, and the
// syntax check (prettier-plugin-apex) does not know these rules; the package build would
// fail only minutes later.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const RESERVED = new Set(
    (
        "abstract activate and any array as asc autonomous begin bigdecimal blob boolean break bulk by byte case cast " +
        "catch char class collect commit const continue currency date datetime decimal default delete desc do double " +
        "else end enum exception exit export extends false final finally float for from global goto group having hint " +
        "if implements import in inner insert instanceof int integer interface into join like limit list long loop map " +
        "merge new not null nulls number object of on or outer override package parallel pragma private protected " +
        "public retrieve return rollback savepoint search select set short sort sql static string super switch " +
        "synchronized system testmethod then this throw time today tolabel tomorrow transaction trigger true try type " +
        "undelete update upsert using virtual void webservice when where while yesterday page"
    ).split(" "),
);

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : path.endsWith(".cls") ? [path] : [];
    });
}

const findings = [];
for (const file of ["force-app", "eh-emulation"].flatMap((d) => walk(join(root, d)))) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, "").replace(/'(?:[^'\\]|\\.)*'/g, "''");
        if (/^\s*(\*|\/\*)/.test(code)) return;
        const patterns = [
            // declarations: Type name =|;|,|)   and   class|interface|enum Name
            /\b(?:[A-Z]\w*|\w+\.\w+)(?:\.\w+)*(?:<[^;()]*?>)?(?:\[\])?\s+([A-Za-z_]\w*)\s*(?=[=;,)])/g,
            /\b(?:class|interface|enum)\s+([A-Za-z_]\w*)/g,
            // method declarations: Type name(
            /\b(?:public|private|protected|global|static)\s+(?:static\s+)?[\w.<>, ]+\s+([A-Za-z_]\w*)\s*\(/g,
        ];
        for (const pattern of patterns) {
            for (const match of code.matchAll(pattern)) {
                const name = match[1];
                const before = code.slice(0, match.index).trim();
                if (/\b(return|new|throw|else)$/.test(before)) continue;
                if (RESERVED.has(name.toLowerCase())) {
                    findings.push(
                        `${relative(root, file)}:${index + 1}: reservierter Name "${name}"`,
                    );
                }
            }
        }
    });
}
if (findings.length) {
    for (const finding of [...new Set(findings)]) console.error(finding);
    process.exit(1);
}
console.log("Keine reservierten Namen in Apex.");
