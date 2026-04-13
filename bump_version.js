#!/usr/bin/env node
/**
 * Atualiza versão semântica do projeto (package.json).
 *
 * Uso:
 *   node bump_version.js patch
 *   node bump_version.js minor
 *   node bump_version.js major
 */

const fs = require("fs");
const path = require("path");

const TYPE = process.argv[2];
if (!TYPE || !["patch", "minor", "major"].includes(TYPE)) {
  console.error("Uso: node bump_version.js patch|minor|major");
  process.exit(1);
}

const PACKAGE_JSON = path.join(__dirname, "package.json");
const raw = fs.readFileSync(PACKAGE_JSON, "utf8");
const pkg = JSON.parse(raw);

const v = String(pkg.version || "").trim();
const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!m) {
  console.error(`Versão inválida em package.json: ${v}`);
  process.exit(1);
}

let major = Number(m[1]);
let minor = Number(m[2]);
let patch = Number(m[3]);

if (TYPE === "patch") patch += 1;
else if (TYPE === "minor") { minor += 1; patch = 0; }
else { major += 1; minor = 0; patch = 0; }

pkg.version = `${major}.${minor}.${patch}`;

fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf8");
process.stdout.write(pkg.version);

