// Decides which layers of a dump must become exported assets, and writes:
//   items.json   -> input for figma_export_many
//   assets.json  -> { nodeId: { file, type } } for figma-to-html.mjs
//
//   node tools/plan-assets.mjs <dump.json> <outDir> [assetDirName]

import fs from "node:fs";
import path from "node:path";
import { isVectorOnly } from "./figma-tree.mjs";

const [, , dumpPath, outDir, assetDirName = "assets"] = process.argv;
const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const root = dump.node || dump.document;
const assetDir = path.join(outDir, assetDirName);
fs.mkdirSync(assetDir, { recursive: true });

const hasImageFill = (n) => Array.isArray(n.fills) && n.fills.some((f) => f && f.type === "IMAGE" && f.visible !== false);

const slug = (s, id) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "layer") + "-" + id.replace(/[:;]/g, "_");

const items = [];
const assets = {};
const add = (node, format, scale) => {
  const file = `${assetDirName}/${slug(node.name, node.id)}.${format.toLowerCase()}`;
  items.push({ nodeId: node.id, savePath: path.resolve(outDir, file), format, scale });
  assets[node.id] = { file, type: format.toLowerCase() };
};

// Figma masks composite in ways CSS cannot express layer by layer, so the container that owns a mask
// is exported as one flat image. From the mask's parent we climb as high as we can while the ancestor
// holds no text, which lands on the whole mockup (phone, hand, screen) and never swallows copy.
const hasText = (n) => n.type === "TEXT" || (n.children || []).some(hasText);
const flatten = new Set();
(function findMasks(node, ancestors) {
  if (node.isMask) {
    let i = ancestors.length - 1;
    let target = ancestors[i];
    while (i > 0) {
      const up = ancestors[i - 1];
      if (!up || up === root || hasText(up)) break;
      target = up;
      i--;
    }
    if (target && target !== root && !hasText(target)) flatten.add(target.id);
  }
  for (const c of node.children || []) findMasks(c, ancestors.concat(node));
})(root, []);

const walk = (node) => {
  if (node.visible === false) return;
  const drawable = typeof node.width === "number" && node.width >= 1 && node.height >= 1;
  if (drawable && node !== root && isVectorOnly(node)) {
    add(node, "SVG", 1); // one crisp asset for the whole icon or illustration
    return; // children are inside the SVG
  }
  if (drawable && flatten.has(node.id)) {
    add(node, "PNG", 2);
    return;
  }
  // A rotated container is flattened into one image: Figma exports it unrotated, and rebuilding its
  // children individually would apply the same angle twice.
  if (drawable && node.rotation && (node.children || []).length) {
    add(node, "PNG", 2);
    return;
  }
  if (drawable && hasImageFill(node)) add(node, "PNG", 2);
  for (const c of node.children || []) walk(c);
};
walk(root);

fs.writeFileSync(path.join(outDir, "items.json"), JSON.stringify(items, null, 1));
fs.writeFileSync(path.join(outDir, "assets.json"), JSON.stringify(assets, null, 1));
const svg = items.filter((i) => i.format === "SVG").length;
console.log(JSON.stringify({ total: items.length, svg, png: items.length - svg, outDir }, null, 1));
