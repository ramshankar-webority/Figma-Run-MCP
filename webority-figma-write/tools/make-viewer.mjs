// Builds a self-contained design viewer: layer tree, specs, CSS, text and code mappings, in one
// HTML file that opens with no Figma account, no seat and no network.
//
//   node tools/make-viewer.mjs <design.json> <outDir> [render.png] [code-map.json]
//
// design.json  : figma_get_node output (depth 20), optionally merged with Code Connect data
// render.png   : a full-frame export, used as the canvas that highlights the selected layer
// code-map.json: .figma/code-map.json from a repo, so viewers see which component maps to what

import fs from "node:fs";
import path from "node:path";

const [, , dumpPath, outDir, renderPath, codeMapPath] = process.argv;
if (!dumpPath || !outDir) {
  console.error("usage: node tools/make-viewer.mjs <design.json> <outDir> [render.png] [code-map.json]");
  process.exit(1);
}
const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const root = dump.node || dump.document;
fs.mkdirSync(outDir, { recursive: true });

const codeMap = codeMapPath && fs.existsSync(codeMapPath) ? JSON.parse(fs.readFileSync(codeMapPath, "utf8")) : { components: {} };
let renderFile = null;
if (renderPath && fs.existsSync(renderPath)) {
  renderFile = "render.png";
  fs.copyFileSync(renderPath, path.join(outDir, renderFile));
}

// Keep only what a reader needs, so the viewer stays small enough to open instantly.
const origin = root.abs ? { x: root.abs.x, y: root.abs.y } : { x: 0, y: 0 };
let count = 0;
function slim(node) {
  count++;
  const o = { i: node.id, n: node.name, t: node.type };
  if (node.abs) {
    o.x = Math.round(node.abs.x - origin.x);
    o.y = Math.round(node.abs.y - origin.y);
    o.w = Math.round(node.abs.width);
    o.h = Math.round(node.abs.height);
  }
  if (node.visible === false) o.hidden = true;
  if (node.opacity !== undefined) o.op = node.opacity;
  if (node.cornerRadius !== undefined) o.r = node.cornerRadius;
  if (node.layout) o.layout = node.layout;
  if (node.sizing) o.sizing = node.sizing;
  if (node.constraints) o.cons = node.constraints;
  if (Array.isArray(node.fills)) o.fills = node.fills.filter((f) => f && f.visible !== false).map((f) => ({ type: f.type, color: f.color, stops: f.stops, scaleMode: f.scaleMode, variable: f.variable, opacity: f.opacity }));
  else if (node.fills === "MIXED") o.fills = "MIXED";
  if (Array.isArray(node.strokes) && node.strokes.length) o.strokes = { paints: node.strokes.map((s) => s.color), weight: node.strokeWeight, sides: node.strokeWeights, align: node.strokeAlign };
  if (Array.isArray(node.effects) && node.effects.length) o.effects = node.effects;
  if (node.styles) o.styles = node.styles;
  if (node.variables) o.vars = node.variables;
  if (node.text) o.text = node.text;
  if (node.componentProperties) o.props = node.componentProperties;
  if (node.instanceProperties) o.iprops = node.instanceProperties;
  if (node.variantProperties) o.variants = node.variantProperties;
  if (node.mainComponent) o.main = node.mainComponent;
  const mapped = codeMap.components?.[node.id] || (node.mainComponent && (codeMap.components?.[node.mainComponent.id] || codeMap.components?.[node.mainComponent.setId])) || node.codeComponent;
  if (mapped) o.code = mapped;
  if (node.children && node.children.length) o.c = node.children.map(slim);
  return o;
}
const tree = slim(root);

// Layer names, text and every other string here come from the Figma file, which is free text.
const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const title = escHtml(root.name);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${title} - design viewer</title>
<style>
  :root { --line:#e6e8f0; --ink:#0b1533; --muted:#6b7490; --brand:#466efa; --bg:#f6f7fb; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.5 "Inter","Segoe UI",system-ui,sans-serif; color:var(--ink); background:var(--bg); height:100vh; display:grid; grid-template-rows:auto 1fr; }
  header { display:flex; gap:16px; align-items:center; padding:10px 16px; background:#fff; border-bottom:1px solid var(--line); }
  header b { font-size:15px; }
  header span { color:var(--muted); font-size:13px; }
  input[type=search] { margin-left:auto; width:min(340px,40vw); padding:8px 12px; border:1px solid var(--line); border-radius:8px; font:inherit; }
  main { display:grid; grid-template-columns:320px 1fr 340px; min-height:0; }
  .panel { background:#fff; overflow:auto; border-right:1px solid var(--line); }
  .panel:last-child { border-right:0; border-left:1px solid var(--line); }
  .tree { padding:8px 0 40px; }
  .row { display:flex; align-items:center; gap:6px; padding:3px 10px; cursor:pointer; white-space:nowrap; font-size:13px; }
  .row:hover { background:#f2f5ff; }
  .row.sel { background:#e6ecff; font-weight:600; }
  .row .tw { width:14px; color:var(--muted); text-align:center; }
  .row .ty { color:var(--muted); font-size:11px; text-transform:lowercase; }
  .row .badge { margin-left:auto; font-size:10px; background:#eaf0ff; color:var(--brand); border-radius:6px; padding:1px 6px; }
  .stage { position:relative; overflow:auto; background:#eceef6; }
  .stage-inner { position:relative; margin:20px auto; box-shadow:0 10px 40px rgba(11,21,51,.12); }
  .stage img { display:block; width:100%; }
  .hl { position:absolute; border:2px solid var(--brand); background:rgba(70,110,250,.12); pointer-events:none; }
  .specs { padding:16px; }
  .specs h3 { margin:0 0 4px; font-size:16px; }
  .specs .sub { color:var(--muted); font-size:12px; margin-bottom:14px; }
  .grp { border-top:1px solid var(--line); padding:12px 0; }
  .grp h4 { margin:0 0 8px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
  .kv { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:13px; }
  .kv span:first-child { color:var(--muted); }
  .sw { display:inline-block; width:12px; height:12px; border-radius:3px; border:1px solid rgba(0,0,0,.12); vertical-align:-2px; margin-right:6px; }
  pre { margin:8px 0 0; padding:10px; background:#0d1330; color:#dfe6ff; border-radius:8px; font:12px/1.5 ui-monospace,Consolas,monospace; overflow:auto; white-space:pre-wrap; }
  button.copy { margin-top:8px; padding:6px 10px; font:inherit; font-size:12px; border:1px solid var(--line); border-radius:7px; background:#fff; cursor:pointer; }
  button.copy:hover { border-color:var(--brand); color:var(--brand); }
  .empty { color:var(--muted); padding:24px 16px; }
  @media (max-width:1100px) { main { grid-template-columns:260px 1fr; } .panel:last-child { grid-column:1 / -1; border-left:0; border-top:1px solid var(--line); max-height:45vh; } }
</style>
</head>
<body>
<header>
  <b>${title}</b>
  <span>${Math.round(Number(root.width) || 0)} x ${Math.round(Number(root.height) || 0)} &middot; ${count} layers &middot; read-only, no Figma account needed</span>
  <input type="search" id="q" placeholder="Search layers and text...">
</header>
<main>
  <div class="panel"><div class="tree" id="tree"></div></div>
  <div class="stage"><div class="stage-inner" id="stage">${renderFile ? `<img src="${renderFile}" alt="${title}">` : '<div class="empty">No render supplied</div>'}<div class="hl" id="hl" hidden></div></div></div>
  <div class="panel"><div class="specs" id="specs"><div class="empty">Pick a layer to see its specs, CSS and code mapping.</div></div></div>
</main>
<script id="data" type="application/json">${JSON.stringify(tree).replace(/</g, "\\u003c")}</script>
<script>
const DATA = JSON.parse(document.getElementById("data").textContent);
const FRAME = { w: ${Math.round(Number(root.width) || 0)}, h: ${Math.round(Number(root.height) || 0)} };
const byId = new Map();
(function index(n, parent) { byId.set(n.i, { node: n, parent }); (n.c || []).forEach((c) => index(c, n)); })(DATA, null);

const treeEl = document.getElementById("tree");
const specsEl = document.getElementById("specs");
const hl = document.getElementById("hl");
const stage = document.getElementById("stage");

function rowFor(n, depth) {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.id = n.i;
  row.style.paddingLeft = 10 + depth * 12 + "px";
  const kids = n.c && n.c.length;
  row.innerHTML = '<span class="tw">' + (kids ? "\\u25B8" : "") + '</span><span class="nm"></span> <span class="ty"></span>' + (n.code ? '<span class="badge">code</span>' : "");
  row.querySelector(".ty").textContent = String(n.t || "").toLowerCase();
  row.querySelector(".nm").textContent = n.n || "(unnamed)";
  row.addEventListener("click", (e) => { e.stopPropagation(); select(n.i); if (kids) toggle(row); });
  return row;
}
function toggle(row) {
  const id = row.dataset.id;
  const open = row.dataset.open === "1";
  row.dataset.open = open ? "0" : "1";
  row.querySelector(".tw").textContent = open ? "\\u25B8" : "\\u25BE";
  if (open) {
    let el = row.nextSibling;
    while (el && Number(el.dataset.depth) > Number(row.dataset.depth)) { const next = el.nextSibling; el.remove(); el = next; }
  } else {
    const n = byId.get(id).node;
    const depth = Number(row.dataset.depth) + 1;
    let anchor = row;
    for (const child of n.c || []) {
      const cr = rowFor(child, depth);
      cr.dataset.depth = depth;
      anchor.after(cr);
      anchor = cr;
    }
  }
}
function renderRoot() {
  treeEl.innerHTML = "";
  const r = rowFor(DATA, 0);
  r.dataset.depth = 0;
  treeEl.append(r);
  toggle(r);
}
renderRoot();

function select(id) {
  const entry = byId.get(id);
  if (!entry) return;
  document.querySelectorAll(".row.sel").forEach((r) => r.classList.remove("sel"));
  const row = treeEl.querySelector('[data-id="' + CSS.escape(id) + '"]');
  if (row) { row.classList.add("sel"); row.scrollIntoView({ block: "nearest" }); }
  const n = entry.node;
  if (n.w && stage.querySelector("img")) {
    const scale = stage.querySelector("img").clientWidth / FRAME.w;
    hl.hidden = false;
    hl.style.left = n.x * scale + "px";
    hl.style.top = n.y * scale + "px";
    hl.style.width = n.w * scale + "px";
    hl.style.height = n.h * scale + "px";
    hl.scrollIntoView({ block: "center", behavior: "smooth" });
  } else hl.hidden = true;
  specsEl.innerHTML = specsFor(n, entry.parent);
  specsEl.querySelectorAll("button.copy").forEach((b) =>
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(b.previousElementSibling.textContent);
      b.textContent = "Copied";
      setTimeout(() => (b.textContent = b.dataset.label), 1200);
    })
  );
}

// Everything below comes from the design file. esc() covers quotes too, kv() escapes both sides, and the
// only raw HTML is a colour swatch, built only from a value that looks like a colour.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const html = (h) => ({ __html: h });
const isColour = (c) => typeof c === "string" && /^(#[0-9a-f]{3,8}|rgba?\\([0-9.,\\s%]+\\))$/i.test(c.trim());
const swatch = (c) => html((isColour(c) ? '<span class="sw" style="background:' + c.trim() + '"></span>' : "") + esc(c));
const joinHtml = (parts) => html(parts.map((p) => (p && p.__html !== undefined ? p.__html : esc(p))).join(" "));

function cssFor(n) {
  const out = [];
  if (n.w) out.push("width: " + n.w + "px;", "height: " + n.h + "px;");
  if (n.layout) {
    const p = n.layout.padding || {};
    out.push("display: flex;", "flex-direction: " + (n.layout.mode === "VERTICAL" ? "column" : "row") + ";");
    if (n.layout.gap) out.push("gap: " + n.layout.gap + "px;");
    if (p.top || p.right || p.bottom || p.left) out.push("padding: " + [p.top, p.right, p.bottom, p.left].map((v) => (v || 0) + "px").join(" ") + ";");
  }
  const solid = Array.isArray(n.fills) && n.fills.find((f) => f.type === "SOLID");
  if (solid) out.push((n.t === "TEXT" ? "color: " : "background: ") + solid.color + ";");
  if (n.r !== undefined && n.r !== null) out.push("border-radius: " + (typeof n.r === "number" ? n.r + "px" : Object.values(n.r).map((v) => (v || 0) + "px").join(" ")) + ";");
  if (n.strokes && n.strokes.paints && n.strokes.paints[0]) out.push("border: " + (n.strokes.weight === "MIXED" ? 1 : n.strokes.weight || 1) + "px solid " + n.strokes.paints[0] + ";");
  if (n.text) {
    const t = n.text;
    if (t.fontName && t.fontName.family) out.push("font-family: " + t.fontName.family + ";");
    if (typeof t.fontSize === "number") out.push("font-size: " + t.fontSize + "px;");
    if (t.lineHeight && t.lineHeight !== "AUTO") out.push("line-height: " + t.lineHeight + ";");
    if (t.letterSpacing && t.letterSpacing !== "0%") out.push("letter-spacing: " + t.letterSpacing + ";");
  }
  for (const e of n.effects || []) {
    if (e.type === "DROP_SHADOW" && e.visible !== false) out.push("box-shadow: " + ((e.offset && e.offset.x) || 0) + "px " + ((e.offset && e.offset.y) || 0) + "px " + (e.radius || 0) + "px " + (e.spread || 0) + "px " + (e.color || "") + ";");
  }
  return out.join("\\n");
}

function specsFor(n, parent) {
  const rows = [];
  const kv = (k, v) => "<span>" + esc(k) + "</span><span>" + (v && v.__html !== undefined ? v.__html : esc(v)) + "</span>";
  rows.push('<h3>' + esc(n.n || "(unnamed)") + "</h3>");
  rows.push('<div class="sub">' + esc(String(n.t || "").toLowerCase()) + " &middot; " + esc(n.i) + (parent ? " &middot; in " + esc(parent.n) : "") + "</div>");
  if (n.w) rows.push('<div class="grp"><h4>Box</h4><div class="kv">' + kv("Size", n.w + " x " + n.h) + kv("Position", n.x + ", " + n.y) + (n.sizing ? kv("Sizing", n.sizing.horizontal + " / " + n.sizing.vertical) : "") + (n.cons ? kv("Constraints", n.cons.horizontal + " / " + n.cons.vertical) : "") + "</div></div>");
  if (n.layout) { const p = n.layout.padding || {}; rows.push('<div class="grp"><h4>Auto layout</h4><div class="kv">' + kv("Direction", n.layout.mode) + kv("Gap", (n.layout.gap || 0) + "px") + kv("Padding", [p.top, p.right, p.bottom, p.left].map((v) => v || 0).join(" ")) + kv("Align", (n.layout.primaryAlign || "-") + " / " + (n.layout.counterAlign || "-")) + "</div></div>"); }
  if (Array.isArray(n.fills) && n.fills.length) rows.push('<div class="grp"><h4>Fills</h4><div class="kv">' + n.fills.map((f) => kv(f.type.toLowerCase(), f.color ? swatch(f.color) : f.stops ? joinHtml(f.stops.map((s) => swatch(s.color))) : f.scaleMode || "-")).join("") + "</div></div>");
  if (n.strokes) rows.push('<div class="grp"><h4>Stroke</h4><div class="kv">' + kv("Colour", swatch(n.strokes.paints[0] || "-")) + kv("Weight", n.strokes.sides ? Object.entries(n.strokes.sides).map(([k, v]) => k + " " + v).join(", ") : n.strokes.weight) + "</div></div>");
  if (n.text) { const t = n.text; rows.push('<div class="grp"><h4>Type</h4><div class="kv">' + kv("Font", (t.fontName && t.fontName.family ? t.fontName.family + " " + t.fontName.style : typeof t.fontName === "string" ? t.fontName : "") || "-") + kv("Size", t.fontSize) + kv("Line height", t.lineHeight) + kv("Letter spacing", t.letterSpacing) + kv("Align", t.textAlignHorizontal) + "</div><pre>" + esc(t.characters || "") + '</pre><button class="copy" data-label="Copy text">Copy text</button></div>'); }
  if (n.vars) rows.push('<div class="grp"><h4>Variables</h4><div class="kv">' + Object.entries(n.vars).map(([k, v]) => kv(k, String(v))).join("") + "</div></div>");
  if (n.styles) rows.push('<div class="grp"><h4>Styles</h4><div class="kv">' + Object.entries(n.styles).map(([k, v]) => kv(k, String(v))).join("") + "</div></div>");
  if (n.props) rows.push('<div class="grp"><h4>Component properties</h4><div class="kv">' + Object.entries(n.props).map(([k, v]) => kv(k, (v.type + (v.options ? ": " + v.options.join(", ") : v.default !== undefined ? " = " + v.default : "")))).join("") + "</div></div>");
  if (n.iprops) rows.push('<div class="grp"><h4>Instance values</h4><div class="kv">' + Object.entries(n.iprops).map(([k, v]) => kv(k, String(v))).join("") + "</div></div>");
  if (n.main) rows.push('<div class="grp"><h4>Main component</h4><div class="kv">' + kv("Name", n.main.name) + (n.main.set ? kv("Set", n.main.set) : "") + "</div></div>");
  if (n.code) rows.push('<div class="grp"><h4>Code mapping</h4><div class="kv">' + kv("Component", n.code.componentName) + (n.code.framework ? kv("Framework", n.code.framework) : "") + (n.code.source ? kv("Source", n.code.source) : "") + "</div><pre>" + esc((n.code.importPath ? 'import { ' + n.code.componentName + ' } from "' + n.code.importPath + '";\\n\\n' : "") + "<" + n.code.componentName + " />") + '</pre><button class="copy" data-label="Copy snippet">Copy snippet</button></div>');
  const css = cssFor(n);
  if (css) rows.push('<div class="grp"><h4>CSS</h4><pre>' + esc(css) + '</pre><button class="copy" data-label="Copy CSS">Copy CSS</button></div>');
  return rows.join("");
}

// Search by layer name or text content
document.getElementById("q").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderRoot(); return; }
  const hits = [];
  byId.forEach(({ node }) => {
    const inName = (node.n || "").toLowerCase().includes(q);
    const inText = node.text && (node.text.characters || "").toLowerCase().includes(q);
    if (inName || inText) hits.push(node);
  });
  treeEl.innerHTML = "";
  hits.slice(0, 400).forEach((n) => { const r = rowFor(n, 0); r.dataset.depth = 0; treeEl.append(r); });
  if (!hits.length) treeEl.innerHTML = '<div class="empty">Nothing matches "' + esc(q) + '"</div>';
});

addEventListener("keydown", (e) => { if (e.key === "Escape") { hl.hidden = true; } });
</script>
</body>
</html>
`;

const out = path.join(outDir, "viewer.html");
fs.writeFileSync(out, html);
console.log(JSON.stringify({ out, layers: count, render: renderFile, mappings: Object.keys(codeMap.components || {}).length, bytes: fs.statSync(out).size }, null, 1));
