// Scans a local codebase for UI components and matches them to Figma components by name and props.
// Local heuristics, plus an optional local Laya model when FIGMA_WRITE_LAYA_URL is set (see addLayaPicks).

import fs from "node:fs";
import path from "node:path";
import { layaUrl, layaPredict } from "./laya.js";

export const CODE_EXTS = new Set([".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".razor", ".cshtml", ".swift", ".kt", ".dart"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "bin", "obj", "dist", "build", ".next", "out", "coverage", ".turbo", "Pods", ".gradle", "wwwroot"]);
const MAX_FILES = 8000;
const MAX_BYTES = 512 * 1024;

const isPascal = (s) => /^[A-Z][A-Za-z0-9]+$/.test(s);

function walk(dir, files) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (files.length >= MAX_FILES) return;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(path.join(dir, e.name), files);
    } else if (CODE_EXTS.has(path.extname(e.name)) && !/\.(test|spec|stories|d)\.[jt]sx?$/.test(e.name)) {
      files.push(path.join(dir, e.name));
    }
  }
}

function propsFor(src, name) {
  const m = src.match(new RegExp(`(?:interface|type)\\s+${name}Props\\s*=?\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) return [];
  return [...m[1].matchAll(/^\s*(?:readonly\s+)?([A-Za-z_][\w]*)\??\s*:/gm)].map((x) => x[1]);
}

export function scanComponents(rootDir) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) throw new Error("sourceDir is not a folder: " + rootDir);
  const files = [];
  walk(rootDir, files);
  const found = [];
  for (const file of files) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    if (stat.size > MAX_BYTES) continue;
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    const rel = path.relative(rootDir, file).replace(/\\/g, "/");
    const add = (name, framework, props = []) => found.push({ name, file: rel, framework, props });

    if (ext === ".vue" || ext === ".svelte") {
      if (isPascal(base)) add(base, ext === ".vue" ? "Vue" : "Svelte");
      continue;
    }
    if (ext === ".razor") {
      if (isPascal(base)) add(base, "Blazor");
      continue;
    }
    if (ext === ".cshtml") {
      const n = base.replace(/^_/, "");
      if (isPascal(n) && base.startsWith("_")) add(n, "Razor partial");
      continue;
    }
    const src = fs.readFileSync(file, "utf8");
    if (ext === ".swift") {
      for (const m of src.matchAll(/struct\s+([A-Z]\w*)\s*:\s*[^{]*\bView\b/g)) add(m[1], "SwiftUI");
      continue;
    }
    if (ext === ".kt") {
      for (const m of src.matchAll(/@Composable\s+(?:\w+\s+)*fun\s+([A-Z]\w*)\s*\(/g)) add(m[1], "Compose");
      continue;
    }
    if (ext === ".dart") {
      for (const m of src.matchAll(/class\s+([A-Z]\w*)\s+extends\s+(?:StatelessWidget|StatefulWidget)/g)) add(m[1], "Flutter");
      continue;
    }
    // JS / TS: exported PascalCase functions, consts and classes. Plain .ts/.js only count with JSX-ish hints.
    if ((ext === ".ts" || ext === ".js") && !/React|jsx|createElement|h\(/.test(src)) continue;
    const names = new Set();
    for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Z]\w*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(",")) {
        const n = part.trim().split(/\s+as\s+/).pop().trim();
        if (isPascal(n)) names.add(n);
      }
    }
    if (/export\s+default\s+/.test(src) && isPascal(base) && base !== "Index") names.add(base);
    // isPascal also filters SCREAMING_CASE constants (ROW_PADDING, BLOCK_GAP), which the export
    // pattern picks up but which are never components.
    for (const n of names) if (isPascal(n) && !n.endsWith("Props") && !n.endsWith("Context") && !n.endsWith("Provider")) add(n, "React", propsFor(src, n));
  }
  return { scannedFiles: files.length, truncated: files.length >= MAX_FILES, components: found };
}

const tokens = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const norm = (s) => tokens(s).join("");

// Figma names like "Buttons/Primary Button" or "Button, Size=Large" -> leaf name tokens.
const figmaLeaf = (name) => String(name).split(",")[0].split("/").map((x) => x.trim()).filter(Boolean);

export function scoreMatch(figma, code) {
  const leafParts = figmaLeaf(figma.name);
  const leaf = leafParts[leafParts.length - 1] || figma.name;
  const a = norm(leaf), full = norm(leafParts.join(" ")), b = norm(code.name);
  if (!a || !b) return 0;
  let score = 0;
  if (a === b || full === b) score = 1;
  else if (a.includes(b) || b.includes(a)) score = 0.55 + 0.35 * (Math.min(a.length, b.length) / Math.max(a.length, b.length));
  else {
    const ta = new Set(tokens(leafParts.join(" "))), tb = new Set(tokens(code.name));
    const inter = [...ta].filter((x) => tb.has(x)).length;
    score = inter ? 0.6 * (inter / new Set([...ta, ...tb]).size) : 0;
  }
  const figmaProps = Object.keys(figma.props || {}).map(norm);
  if (score > 0 && figmaProps.length && code.props.length) {
    const cp = new Set(code.props.map(norm));
    const overlap = figmaProps.filter((p) => cp.has(p)).length / figmaProps.length;
    score = Math.min(1, score + 0.1 * overlap);
  }
  return Math.round(score * 100) / 100;
}

export function suggestMappings(figmaComponents, codeComponents, { minConfidence = 0.4, perComponent = 3 } = {}) {
  return figmaComponents.map((f) => {
    const candidates = codeComponents
      .map((c) => ({ ...c, confidence: scoreMatch(f, c) }))
      .filter((c) => c.confidence >= minConfidence)
      .sort((x, y) => y.confidence - x.confidence)
      .slice(0, perComponent)
      .map((c) => ({
        componentName: c.name,
        file: c.file,
        framework: c.framework,
        confidence: c.confidence,
        method: "name",
        propMatch: Object.keys(f.props || {}).map((p) => ({ figma: p, code: c.props.find((cp) => norm(cp) === norm(p)) || null })),
      }));
    return { figmaId: f.id, figmaName: f.name, alreadyMapped: !!f.mapping, candidates };
  });
}

// Optional second opinion from Laya (github.com/NandhaKishorM/laya), a local decision model served by
// `laya-serve` over POST /v1/systemone. Off unless FIGMA_WRITE_LAYA_URL is set, so nothing changes without it.
// Name matching wins when it is sure; Laya is asked only where it is not, because a CPU answer takes seconds.
const LAYA_SURE = 0.9;
const LAYA_POOL = 11; // candidates per question, so a question fits the 512-token English checkpoint
const LAYA_MAX = 30; // components per call; a larger page would take minutes

async function layaChoose(url, figma, pool) {
  const folder = (file) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".");
  const body = {
    state: { figma_component: figma.name, figma_properties: Object.keys(figma.props || {}).join(", ") || "none" },
    questions: {
      match: {
        type: "choice",
        instructions: "Which code component implements this Figma design component?",
        criteria: Object.fromEntries(pool.map((c) => [c.name, `${c.framework} component in ${folder(c.file)}${c.props.length ? " props: " + c.props.slice(0, 5).join(", ") : ""}`])),
      },
    },
  };
  const a = (await layaPredict(body.state, body.questions, url, 30000, "english")).answers.match;
  // Laya's `confidence` for a choice is a margin, not the pick's probability; prefer probabilities[choice].
  const p = a.probabilities && typeof a.probabilities[a.choice] === "number" ? a.probabilities[a.choice] : a.confidence || 0;
  return { name: a.choice, confidence: Math.round(p * 100) / 100 };
}

// Adds Laya's pick to each suggestion whose best name match is below LAYA_SURE. Laya picks from every
// scanned component in rounds of LAYA_POOL, then once more among the round winners. Its pick is
// marked `method: "laya"`; its confidence is uncalibrated, so it is kept even below minConfidence.
export async function addLayaPicks(suggestions, figmaComponents, codeComponents, url = layaUrl()) {
  if (!url) return { used: false };
  url = url.replace(/\/+$/, "");
  const codes = [...new Map(codeComponents.map((c) => [c.name, c])).values()]; // criteria keys must be unique
  const byId = new Map(figmaComponents.map((f) => [f.id, f]));
  const todo = suggestions.filter((s) => !(s.candidates[0] && s.candidates[0].confidence >= LAYA_SURE));
  let asked = 0;
  try {
    for (const s of todo.slice(0, LAYA_MAX)) {
      const f = byId.get(s.figmaId);
      const rounds = [];
      for (let i = 0; i < codes.length; i += LAYA_POOL) rounds.push(await layaChoose(url, f, codes.slice(i, i + LAYA_POOL)));
      const winners = rounds.map((r) => r.name);
      const pick = rounds.length > 1 ? await layaChoose(url, f, codes.filter((c) => winners.includes(c.name))) : rounds[0];
      const c = codes.find((x) => x.name === pick.name);
      if (!c) continue;
      s.candidates = s.candidates.filter((x) => !(x.componentName === c.name && x.file === c.file));
      s.candidates.unshift({
        componentName: c.name,
        file: c.file,
        framework: c.framework,
        confidence: pick.confidence,
        method: "laya",
        propMatch: Object.keys(f.props || {}).map((p) => ({ figma: p, code: c.props.find((cp) => norm(cp) === norm(p)) || null })),
      });
      asked++;
    }
  } catch (e) {
    return { used: true, asked, error: e.message, hint: "Is laya-serve running at " + url + "? Name matching is still shown." };
  }
  return { used: true, asked, skipped: Math.max(0, todo.length - LAYA_MAX), sureByName: suggestions.length - todo.length };
}
