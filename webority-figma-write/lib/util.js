// Small helpers shared by the tool files, so every tool treats ids and save paths the same way.

import fs from "node:fs";
import path from "node:path";

// A Figma URL writes node ids with dashes ('826-2', '1-2-3' for nested instances); the API uses colons.
export const normId = (id) => (typeof id === "string" && id.includes("-") && !id.includes(":") ? id.replace(/-/g, ":") : id);

// Checks a savePath before any slow work, and creates its folder.
export function prepareSavePath(savePath) {
  if (!savePath) return null;
  if (!path.isAbsolute(savePath)) throw new Error("savePath must be an absolute path: " + savePath);
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  return savePath;
}

// The mapping key for a snapshot layer: the component set for a variant, else the component, else the layer.
export function mappingKeys(node, fallbackId) {
  const mc = node && node.mainComponent;
  return [mc && mc.setId, mc && mc.id, node && node.id, fallbackId].filter(Boolean);
}

// Resolves a code mapping's `source` for reading. The source string comes from the Figma file, which
// anyone with edit access to it (or to a library it uses) can set, so it is confined: it must be
// relative, it must stay inside sourceDir after links are resolved, and it must be a code file.
export function confinedSourcePath(sourceDir, source, allowedExts) {
  if (!sourceDir) return { error: "Pass sourceDir to read the mapped source file." };
  if (!path.isAbsolute(sourceDir)) return { error: "sourceDir must be an absolute path." };
  if (path.isAbsolute(source) || /^[\/]{2}/.test(source)) return { error: "The mapping's source is an absolute path, so it is not read. Use a path relative to sourceDir." };
  if (!allowedExts.has(path.extname(source).toLowerCase())) return { error: "The mapping's source is not a code file, so it is not read." };
  let root, file;
  try {
    root = fs.realpathSync(sourceDir);
    file = fs.realpathSync(path.resolve(root, source));
  } catch {
    return { error: "File not found on this PC.", path: path.resolve(sourceDir, source) };
  }
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return { error: "The mapping's source points outside sourceDir, so it is not read." };
  if (!fs.statSync(file).isFile()) return { error: "Not a file.", path: file };
  return { file };
}
