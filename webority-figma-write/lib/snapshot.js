// Design snapshots: the whole design saved to one JSON file, so the read tools keep working with no
// Figma open, no plugin and no seat. Someone with access runs figma_save_snapshot once; after that a
// teammate on a free or view-only seat answers every design question from the file.

import fs from "node:fs";
import path from "node:path";

const cache = new Map(); // path -> { mtimeMs, data }

export function loadSnapshot(file) {
  if (!fs.existsSync(file)) throw new Error("No snapshot at " + file + ". Ask someone with Figma access to run figma_save_snapshot.");
  const stat = fs.statSync(file);
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.data;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data.root && !data.node && !data.document) throw new Error("That file is not a design snapshot: " + file);
  const snap = {
    file,
    savedAt: data.savedAt || stat.mtime.toISOString(),
    fileName: data.fileName || (data.figma && data.figma.fileName) || "unknown",
    pages: data.pages || null,
    styles: data.styles || null,
    variables: data.variables || null,
    codeMap: data.codeMap || null,
    assets: data.assets || null,
    root: data.root || data.node || data.document,
  };
  cache.set(file, { mtimeMs: stat.mtimeMs, data: snap });
  return snap;
}

export function walk(node, fn, parent = null) {
  fn(node, parent);
  for (const c of node.children || []) walk(c, fn, node);
}

export function findById(snap, nodeId) {
  let found = null;
  let parent = null;
  walk(snap.root, (n, p) => {
    if (!found && n.id === nodeId) {
      found = n;
      parent = p;
    }
  });
  return { node: found, parent };
}

export function pathOf(snap, nodeId) {
  const chain = [];
  (function search(node, trail) {
    if (chain.length) return;
    if (node.id === nodeId) {
      chain.push(...trail.map((n) => n.name));
      return;
    }
    for (const c of node.children || []) search(c, trail.concat(node));
  })(snap.root, []);
  return chain.join(" / ");
}

// Trims a node to the requested depth, so a caller can ask for an overview without the whole tree.
export function prune(node, depth, counter, limit) {
  const copy = { ...node };
  delete copy.children;
  if (node.children && node.children.length) {
    copy.childCount = node.children.length;
    if (depth > 0) {
      copy.children = [];
      for (const c of node.children) {
        if (counter.n >= limit) {
          copy.truncated = true;
          break;
        }
        counter.n++;
        copy.children.push(prune(c, depth - 1, counter, limit));
      }
    }
  }
  return copy;
}

export function metadata(snap) {
  const top = (snap.root.children || []).map((c) => ({ id: c.id, name: c.name, type: c.type, width: c.width, height: c.height }));
  let layers = 0;
  let text = 0;
  const types = {};
  walk(snap.root, (n) => {
    layers++;
    types[n.type] = (types[n.type] || 0) + 1;
    if (n.type === "TEXT") text++;
  });
  return {
    source: "snapshot",
    file: snap.file,
    savedAt: snap.savedAt,
    figmaFile: snap.fileName,
    root: { id: snap.root.id, name: snap.root.name, type: snap.root.type, width: snap.root.width, height: snap.root.height },
    layers,
    textLayers: text,
    types,
    topLevel: top,
    pages: snap.pages,
    hasStyles: Boolean(snap.styles),
    hasVariables: Boolean(snap.variables),
    mappedComponents: snap.codeMap ? Object.keys(snap.codeMap).length : 0,
  };
}

export function findNodes(snap, { name, regex, text, types, limit = 200 }) {
  const re = name ? (regex ? new RegExp(name, "i") : { test: (s) => String(s).toLowerCase().includes(String(name).toLowerCase()) }) : null;
  const rows = [];
  walk(snap.root, (n) => {
    if (rows.length >= limit) return;
    if (types && types.length && !types.includes(n.type)) return;
    if (re && !re.test(n.name)) return;
    if (text && !(n.type === "TEXT" && String(n.text?.characters || "").toLowerCase().includes(String(text).toLowerCase()))) return;
    rows.push({ id: n.id, name: n.name, type: n.type, width: n.width, height: n.height, path: pathOf(snap, n.id), characters: n.type === "TEXT" ? String(n.text?.characters || "").slice(0, 120) : undefined });
  });
  return { source: "snapshot", count: rows.length, truncated: rows.length >= limit, nodes: rows };
}

export function texts(snap, { nodeId, limit = 500, withStyle = true }) {
  const start = nodeId ? findById(snap, nodeId).node : snap.root;
  if (!start) throw new Error("Node not found in snapshot: " + nodeId);
  const rows = [];
  walk(start, (n) => {
    if (n.type !== "TEXT" || rows.length >= limit) return;
    const t = n.text || {};
    const row = { id: n.id, name: n.name, characters: t.characters, path: pathOf(snap, n.id) };
    if (withStyle) {
      row.fontSize = t.fontSize;
      row.fontName = t.fontName;
      row.lineHeight = t.lineHeight;
      row.letterSpacing = t.letterSpacing;
      row.align = t.textAlignHorizontal;
      const solid = Array.isArray(n.fills) ? n.fills.find((f) => f && f.type === "SOLID") : null;
      if (solid) row.color = solid.color;
      if (n.styles && n.styles.text) row.textStyle = n.styles.text;
    }
    rows.push(row);
  });
  return { source: "snapshot", count: rows.length, truncated: rows.length >= limit, texts: rows };
}

export function saveSnapshot(file, payload) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ savedAt: new Date().toISOString(), ...payload }));
  cache.delete(target);
  return { file: target, bytes: fs.statSync(target).size };
}

// Where a viewer's snapshot and code map live. FIGMA_PROJECT_DIR wins; otherwise walk up from the
// working directory looking for a .figma folder, which is the project root in practice. This is what
// lets a developer on a free, view-only seat call the read tools with no arguments and get answers.
export function findProjectDir(env = process.env, cwd = process.cwd()) {
  if (env.FIGMA_PROJECT_DIR && fs.existsSync(path.join(env.FIGMA_PROJECT_DIR, ".figma"))) return env.FIGMA_PROJECT_DIR;
  let dir = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, ".figma"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

export function defaultSnapshotPath(env = process.env, cwd = process.cwd()) {
  if (env.FIGMA_SNAPSHOT && fs.existsSync(env.FIGMA_SNAPSHOT)) return env.FIGMA_SNAPSHOT;
  const project = findProjectDir(env, cwd);
  if (!project) return null;
  const file = path.join(project, ".figma", "design-snapshot.json");
  return fs.existsSync(file) ? file : null;
}
