// Rebuilds a Figma frame as a static HTML page, pixel for pixel.
//
//   node tools/figma-to-html.mjs <dump.json> <outDir> [assets.json]
//
// dump.json   : output of figma_get_node (depth 20, maxNodes 5000) for the frame
// assets.json : { "<nodeId>": { "file": "assets/x.svg", "type": "svg" | "png" } } from figma_export_many
//
// Layout strategy: every layer is absolutely positioned at the x/y Figma reports, inside its parent.
// That is what makes it pixel exact; auto layout is recorded in a data attribute for reference, not
// used for placement. Vectors and icons come in as exported SVG, image fills as their original bytes.

import fs from "node:fs";
import path from "node:path";
import { isVectorOnly } from "./figma-tree.mjs";

const [, , dumpPath, outDir, assetsPath] = process.argv;
if (!dumpPath || !outDir) {
  console.error("usage: node tools/figma-to-html.mjs <dump.json> <outDir> [assets.json]");
  process.exit(1);
}
const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const root = dump.node || dump.document;
const assets = assetsPath && fs.existsSync(assetsPath) ? JSON.parse(fs.readFileSync(assetsPath, "utf8")) : {};
fs.mkdirSync(outDir, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const px = (n) => (Math.round(n * 100) / 100) + "px";
const stats = { nodes: 0, text: 0, assets: 0, images: 0, mapped: 0, skipped: 0 };

// A layer is drawn as one exported asset when it is a vector, or a group that only holds vectors.
function fontStack(family) {
  const fallback = {
    Inter: "'Inter', 'Segoe UI', system-ui, sans-serif",
    "Zalando Sans": "'Zalando Sans', 'Inter', system-ui, sans-serif",
    Gilroy: "'Gilroy', 'Inter', system-ui, sans-serif",
    "SF Pro": "-apple-system, 'SF Pro Text', 'Inter', system-ui, sans-serif",
    Fraunces: "'Fraunces', Georgia, serif",
    "Bricolage Grotesque": "'Bricolage Grotesque', 'Inter', system-ui, sans-serif",
  };
  // Strip the optical-size suffix Figma adds, e.g. "Fraunces 72pt".
  const clean = String(family).replace(/\s+\d+pt$/, "");
  return fallback[clean] || `'${clean}', 'Inter', system-ui, sans-serif`;
}

const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Book: 400, Medium: 500, SemiBold: 600, "Semi Bold": 600, Bold: 700, ExtraBold: 800, Black: 900 };
function weightOf(style = "Regular") {
  const clean = String(style).replace(/italic/i, "").trim() || "Regular";
  return WEIGHTS[clean] ?? (/semi/i.test(clean) ? 600 : /bold/i.test(clean) ? 700 : /medium/i.test(clean) ? 500 : /light/i.test(clean) ? 300 : 400);
}

function gradientCss(fill) {
  const stops = (fill.stops || []).map((s) => `${s.color} ${Math.round(s.position * 100)}%`).join(", ");
  if (!stops) return null;
  if (fill.type === "GRADIENT_RADIAL" || fill.type === "GRADIENT_DIAMOND") return `radial-gradient(circle, ${stops})`;
  if (fill.type === "GRADIENT_ANGULAR") return `conic-gradient(${stops})`;
  return `linear-gradient(180deg, ${stops})`;
}

function backgroundFrom(node, asset) {
  const out = [];
  const fills = Array.isArray(node.fills) ? node.fills.filter((f) => f && f.visible !== false) : [];
  for (const f of fills) {
    if (f.type === "SOLID") out.push({ css: `linear-gradient(${f.color}, ${f.color})`, solid: f.color });
    else if (String(f.type).startsWith("GRADIENT")) {
      const g = gradientCss(f);
      if (g) out.push({ css: g });
    } else if (f.type === "IMAGE") {
      const a = asset && asset.type !== "svg" ? asset : null;
      if (a) {
        stats.images++;
        const size = f.scaleMode === "FIT" ? "contain" : f.scaleMode === "TILE" ? "auto" : "cover";
        // Single quotes: this string ends up inside a style="..." attribute.
        out.push({ css: `url('${a.file}')`, size, repeat: f.scaleMode === "TILE" ? "repeat" : "no-repeat", blend: f.blendMode });
      }
    }
  }
  return out;
}

function radiusOf(node) {
  const r = node.cornerRadius;
  if (r === undefined || r === null) return null;
  if (typeof r === "number") return r ? px(r) : null;
  return [r.topLeft, r.topRight, r.bottomRight, r.bottomLeft].map((v) => px(v || 0)).join(" ");
}

function shadowCss(effects) {
  const box = [];
  const filters = [];
  for (const e of effects || []) {
    if (e.visible === false) continue;
    if (e.type === "DROP_SHADOW") box.push(`${px((e.offset && e.offset.x) || 0)} ${px((e.offset && e.offset.y) || 0)} ${px(e.radius || 0)} ${px(e.spread || 0)} ${e.color || "#0000001a"}`);
    else if (e.type === "INNER_SHADOW") box.push(`inset ${px((e.offset && e.offset.x) || 0)} ${px((e.offset && e.offset.y) || 0)} ${px(e.radius || 0)} ${px(e.spread || 0)} ${e.color || "#0000001a"}`);
    else if (e.type === "LAYER_BLUR") filters.push(`blur(${px((e.radius || 0) / 2)})`);
  }
  const backdrop = (effects || []).filter((e) => e.type === "BACKGROUND_BLUR" && e.visible !== false).map((e) => `blur(${px((e.radius || 0) / 2)})`);
  return { box, filters, backdrop };
}

function textCss(node) {
  const t = node.text || {};
  const css = [];
  const family = t.fontName && t.fontName.family ? t.fontName.family : "Inter";
  const style = t.fontName && t.fontName.style ? t.fontName.style : "Regular";
  css.push(`font-family:${fontStack(family)}`);
  css.push(`font-weight:${weightOf(style)}`);
  if (/italic/i.test(style)) css.push("font-style:italic");
  const segSizes = Array.isArray(t.segments) ? t.segments.map((x) => x.fontSize).filter((x) => typeof x === "number") : [];
  if (typeof t.fontSize === "number") css.push(`font-size:${px(t.fontSize)}`);
  else if (segSizes.length) css.push(`font-size:${px(Math.max(...segSizes))}`);
  if (t.lineHeight && t.lineHeight !== "AUTO" && t.lineHeight !== "MIXED") css.push(`line-height:${t.lineHeight}`);
  else css.push("line-height:normal");
  if (t.letterSpacing && t.letterSpacing !== "MIXED" && t.letterSpacing !== "0%" && t.letterSpacing !== "0px") {
    css.push(`letter-spacing:${String(t.letterSpacing).endsWith("%") ? (parseFloat(t.letterSpacing) / 100) + "em" : t.letterSpacing}`);
  }
  const align = { LEFT: "left", CENTER: "center", RIGHT: "right", JUSTIFIED: "justify" }[t.textAlignHorizontal] || "left";
  css.push(`text-align:${align}`);
  const justify = { TOP: "flex-start", CENTER: "center", BOTTOM: "flex-end" }[t.textAlignVertical] || "flex-start";
  css.push("display:flex", "flex-direction:column", `justify-content:${justify}`);
  if (t.textCase === "UPPER") css.push("text-transform:uppercase");
  if (t.textCase === "LOWER") css.push("text-transform:lowercase");
  if (t.textCase === "TITLE") css.push("text-transform:capitalize");
  if (t.textDecoration === "UNDERLINE") css.push("text-decoration:underline");
  if (t.textDecoration === "STRIKETHROUGH") css.push("text-decoration:line-through");
  const solid = Array.isArray(node.fills) ? node.fills.find((f) => f && f.type === "SOLID" && f.visible !== false) : null;
  if (solid) css.push(`color:${solid.color}`);
  css.push(t.textAutoResize === "WIDTH_AND_HEIGHT" ? "white-space:pre" : "white-space:pre-wrap");
  if (t.textAutoResize === "WIDTH_AND_HEIGHT") css.push("width:max-content", "height:max-content");
  return css;
}

// Figma stores stray carriage returns in pasted copy that it then renders as a space. The box height
// says how many lines the layer really has, so a one-line box keeps its text on one line.
function lineCount(node) {
  const t = node.text || {};
  const size = typeof t.fontSize === "number" ? t.fontSize : 16;
  let lh = size * 1.21;
  if (typeof t.lineHeight === "string" && t.lineHeight.endsWith("px")) lh = parseFloat(t.lineHeight);
  else if (typeof t.lineHeight === "string" && t.lineHeight.endsWith("%")) lh = (parseFloat(t.lineHeight) / 100) * size;
  if (!(lh > 0)) lh = size * 1.21;
  return Math.max(1, Math.round((node.height || lh) / lh));
}

const BREAKS = new RegExp("[" + String.fromCharCode(13) + String.fromCharCode(10) + "]+", "g");
const flatten = (s) => String(s).replace(BREAKS, " ");

function textOf(node) {
  const chars = (node.text && node.text.characters) || "";
  return lineCount(node) === 1 ? flatten(chars) : chars;
}

function render(node, parent, depth) {
  if (node.visible === false) {
    stats.skipped++;
    return "";
  }
  stats.nodes++;
  const asset = assets[node.id];
  // Absolute boxes are the reliable coordinate: a child of a GROUP reports x/y in the frame's space,
  // not the group's, so plain x/y would shift every grouped layer.
  let x, y;
  if (node.abs && parent && parent.abs) {
    x = node.abs.x - parent.abs.x;
    y = node.abs.y - parent.abs.y;
  } else {
    x = typeof node.x === "number" ? node.x : 0;
    y = typeof node.y === "number" ? node.y : 0;
  }
  const rotated = !!node.rotation && node.abs && parent && parent.abs;
  if (rotated) {
    const cx = node.abs.x + node.abs.width / 2 - parent.abs.x;
    const cy = node.abs.y + node.abs.height / 2 - parent.abs.y;
    x = cx - node.width / 2;
    y = cy - node.height / 2;
  }
  const css = ["position:absolute", `left:${px(x)}`, `top:${px(y)}`];
  if (typeof node.width === "number") css.push(`width:${px(node.width)}`, `height:${px(node.height)}`);
  if (typeof node.opacity === "number" && node.opacity !== 1) css.push(`opacity:${node.opacity}`);
  // An exported asset already looks the way Figma draws it, so it is never rotated again here.
  if (node.rotation && !asset) css.push(`transform:rotate(${-node.rotation}deg)`, "transform-origin:center center");
  if (node.blendMode && node.blendMode !== "NORMAL" && node.blendMode !== "PASS_THROUGH") css.push(`mix-blend-mode:${String(node.blendMode).toLowerCase().replace(/_/g, "-")}`);
  if (node.clipsContent) css.push("overflow:hidden");

  // Vector artwork: one exported SVG, children not rebuilt.
  // Vector art, rotated containers and masked mockups are each drawn as their single exported asset.
  if (asset && (isVectorOnly(node) || asset.type === "svg" || ((node.children || []).length && (node.rotation || (node.children || []).some((c) => c.isMask) || asset.type === "png")))) {
    stats.assets++;
    const attrs = `data-figma-id="${esc(node.id)}" data-name="${esc(node.name)}"`;
    return `<img src="${asset.file}" alt="${esc(node.name)}" ${attrs} style="${css.join(";")}">`;
  }

  const radius = radiusOf(node);
  if (radius) css.push(`border-radius:${radius}`);
  // CSS paints the first background layer on top; Figma paints fills[0] at the bottom.
  const backgrounds = (node.type === "TEXT" ? [] : backgroundFrom(node, asset)).reverse();
  if (backgrounds.length) {
    css.push(`background-image:${backgrounds.map((b) => b.css).join(",")}`);
    if (backgrounds.some((b) => b.size)) css.push(`background-size:${backgrounds.map((b) => b.size || "auto").join(",")}`);
    css.push(`background-repeat:${backgrounds.map((b) => b.repeat || "no-repeat").join(",")}`);
    css.push("background-position:center");
    const blends = backgrounds.map((b) => (b.blend ? String(b.blend).toLowerCase().replace(/_/g, "-") : "normal"));
    if (blends.some((b) => b !== "normal")) css.push(`background-blend-mode:${blends.join(",")}`);
  }
  if (Array.isArray(node.strokes) && node.strokes.length) {
    const s = node.strokes.find((x) => x && x.type === "SOLID");
    const w = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
    if (s && node.strokeWeights) {
      // Per-side weights: only the sides Figma actually draws get a border.
      css.push("box-sizing:border-box");
      for (const [side, weight] of Object.entries(node.strokeWeights)) {
        if (weight) css.push(`border-${side}:${px(weight)} solid ${s.color}`);
      }
    } else if (s) {
      css.push(node.strokeAlign === "OUTSIDE" ? `outline:${px(w)} solid ${s.color};outline-offset:0` : `box-sizing:border-box;border:${px(w)} solid ${s.color}`);
    }
  }
  const fx = shadowCss(node.effects);
  if (fx.box.length) css.push(`box-shadow:${fx.box.join(",")}`);
  if (fx.filters.length) css.push(`filter:${fx.filters.join(" ")}`);
  if (fx.backdrop.length) css.push(`backdrop-filter:${fx.backdrop.join(" ")}`, `-webkit-backdrop-filter:${fx.backdrop.join(" ")}`);

  const dataAttrs = [`data-figma-id="${esc(node.id)}"`, `data-name="${esc(node.name)}"`, `data-type="${esc(node.type)}"`];
  if (node.layout) dataAttrs.push(`data-autolayout="${esc(node.layout.mode + " gap:" + node.layout.gap)}"`);
  if (node.mainComponent) dataAttrs.push(`data-component="${esc(node.mainComponent.set || node.mainComponent.name)}"`);
  if (node.codeComponent) {
    stats.mapped++;
    dataAttrs.push(`data-code-component="${esc(node.codeComponent.componentName)}"`, `data-code-source="${esc(node.codeComponent.source || "")}"`);
  }

  if (node.type === "TEXT") {
    stats.text++;
    const t = node.text || {};
    const chars = textOf(node);
    let inner = `<span>${esc(chars)}</span>`;
    if (Array.isArray(t.segments) && t.segments.length) {
      // Mixed fonts or sizes inside one layer: one span per run, in order.
      inner = "<span>" + t.segments
        .map((seg) => {
          const bits = [];
          if (seg.fontName && seg.fontName.family) {
            bits.push(`font-family:${fontStack(seg.fontName.family)}`, `font-weight:${weightOf(seg.fontName.style)}`);
            if (/italic/i.test(seg.fontName.style || "")) bits.push("font-style:italic");
          }
          if (typeof seg.fontSize === "number") bits.push(`font-size:${px(seg.fontSize)}`);
          if (seg.color) bits.push(`color:${seg.color}`);
          const runText = lineCount(node) === 1 ? flatten(seg.text) : seg.text;

          return `<span style="${bits.join(";")}">${esc(runText)}</span>`;
        })
        .join("") + "</span>";
    }
    return `<div ${dataAttrs.join(" ")} style="${css.concat(textCss(node)).join(";")}">${inner}</div>`;
  }

  const children = node.children || [];
  if (children.some((c) => c.isMask) && !css.some((c) => c.startsWith("overflow"))) css.push("overflow:hidden");
  const inner = children.filter((c) => !c.isMask).map((c) => render(c, node, depth + 1)).join("");
  return `<div ${dataAttrs.join(" ")} style="${css.join(";")}">${inner}</div>`;
}

// Code Connect mappings ride along in the dump when the caller merged them in.
const body = (root.children || []).map((c) => render(c, root, 1)).join("");
const fontFamilies = new Set();
(function collectFonts(n) {
  if (n.type === "TEXT" && n.text) {
    if (n.text.fontName && n.text.fontName.family) fontFamilies.add(String(n.text.fontName.family).replace(/\s+\d+pt$/, ""));
    for (const seg of n.text.segments || []) if (seg.fontName && seg.fontName.family) fontFamilies.add(String(seg.fontName.family).replace(/\s+\d+pt$/, ""));
  }
  for (const c of n.children || []) collectFonts(c);
})(root);

const googleFonts = [...fontFamilies].filter((f) => ["Inter", "Fraunces", "Bricolage Grotesque", "Zalando Sans"].includes(f));
const fontLink = googleFonts.length
  ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${googleFonts
      .map((f) => "family=" + f.replace(/ /g, "+") + ":ital,wght@0,100..900;1,100..900")
      .join("&")}&display=swap" rel="stylesheet">`
  : "";

const rootBg = (root.fills || []).find((f) => f && f.type === "SOLID");
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${Math.round(root.width)}">
<title>${esc(root.name)}</title>
${fontLink}
<style>
  * { margin:0; padding:0; box-sizing:content-box; }
  body { background:${rootBg ? rootBg.color : "#ffffff"}; }
  #page { position:relative; width:${px(root.width)}; height:${px(root.height)}; overflow:hidden; background:${rootBg ? rootBg.color : "#ffffff"}; margin:0 auto; }
  #page div { box-sizing:content-box; }
  img { display:block; }
</style>
</head>
<body>
<div id="page" data-figma-id="${esc(root.id)}" data-name="${esc(root.name)}">
${body}
</div>
</body>
</html>
`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(JSON.stringify({ out: path.join(outDir, "index.html"), size: root.width + "x" + root.height, ...stats, fonts: [...fontFamilies] }, null, 1));
