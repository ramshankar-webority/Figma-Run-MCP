// Attaches Code Connect mappings to the instances in a dump, so the rebuilt HTML says which code
// component each region is. Instances resolve through mainComponent (set name or id).
//
//   node tools/merge-code-connect.mjs <dump.json> <mappings.json> <out.json>
//
// mappings.json is the output of figma_get_code_connect_map with no nodeId.

import fs from "node:fs";

const [, , dumpPath, mapPath, outPath] = process.argv;
const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const maps = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const byId = new Map();
const byName = new Map();
for (const c of maps.components || []) {
  if (!c.mapping) continue;
  byId.set(c.id, c.mapping);
  byName.set(c.name, c.mapping);
}

let tagged = 0;
const used = new Map();
(function walk(n) {
  if (n.type === "INSTANCE" && n.mainComponent) {
    const m = byId.get(n.mainComponent.id) || byName.get(n.mainComponent.set || "") || byName.get(n.mainComponent.name || "");
    if (m) {
      n.codeComponent = m;
      tagged++;
      used.set(m.componentName, (used.get(m.componentName) || 0) + 1);
    }
  }
  for (const c of n.children || []) walk(c);
})(dump.node || dump.document);

fs.writeFileSync(outPath, JSON.stringify(dump));
console.log(JSON.stringify({ tagged, components: Object.fromEntries(used) }));
