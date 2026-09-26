// Code Connect mappings kept in the repo instead of inside the Figma file.
//
// Why: writing a mapping into a Figma file needs edit access. A teammate on a free or view-only
// seat has none, so their mappings live in <repo>/.figma/code-map.json, which anyone can read,
// review in a pull request, and use offline. Whoever does have edit access can push the file's
// mappings up into Figma later, so Dev Mode shows them too.

import fs from "node:fs";
import path from "node:path";

export const STORE_DIR = ".figma";
export const STORE_FILE = "code-map.json";

export function storePath(repoDir) {
  return path.join(repoDir, STORE_DIR, STORE_FILE);
}

export function readStore(repoDir) {
  const file = storePath(repoDir);
  if (!fs.existsSync(file)) return { version: 1, file: null, components: {} };
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!parsed.components) parsed.components = {};
  return parsed;
}

export function writeStore(repoDir, store) {
  const file = storePath(repoDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  store.updatedAt = new Date().toISOString();
  // Sorted keys keep the diff readable when two people map components on different days.
  const ordered = { ...store, components: Object.fromEntries(Object.entries(store.components).sort(([a], [b]) => a.localeCompare(b))) };
  fs.writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
  return file;
}

export function setMapping(repoDir, { nodeId, name, mapping, fileKey, fileName }) {
  const store = readStore(repoDir);
  if (fileKey) store.fileKey = fileKey;
  if (fileName) store.file = fileName;
  store.components[nodeId] = { name: name || store.components[nodeId]?.name, ...mapping, updatedAt: new Date().toISOString() };
  return { file: writeStore(repoDir, store), mapping: store.components[nodeId] };
}

export function removeMapping(repoDir, nodeId) {
  const store = readStore(repoDir);
  const had = Boolean(store.components[nodeId]);
  delete store.components[nodeId];
  writeStore(repoDir, store);
  return had;
}

// Renders the mapping as the snippet a developer pastes, the same shape the plugin shows in Dev Mode.
export function snippetFor(mapping, values = {}) {
  if (mapping.template) return mapping.template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (values[k] !== undefined ? String(values[k]) : m));
  const attrs = Object.entries(values)
    .filter(([k]) => k !== "children")
    .map(([k, v]) => (typeof v === "boolean" ? (v ? k : `${k}={false}`) : `${k}="${String(v).replace(/"/g, "&quot;")}"`))
    .join(" ");
  const importLine = mapping.importPath ? `import { ${mapping.componentName} } from "${mapping.importPath}";\n\n` : "";
  const open = `<${mapping.componentName}${attrs ? " " + attrs : ""}`;
  return importLine + (values.children !== undefined ? `${open}>${values.children}</${mapping.componentName}>` : `${open} />`);
}
