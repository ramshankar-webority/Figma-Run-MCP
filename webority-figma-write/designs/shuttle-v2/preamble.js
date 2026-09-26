// Shuttle helpers: Zalando Sans, Iconsax (ISX injected), Pexels photos (B64 injected),
// light-mode iOS Liquid Glass (Figma GLASS effect, frosted fallback), 100% corner smoothing.

const FAMILY = "Zalando Sans";
const available = (await figma.listAvailableFontsAsync()).filter((f) => f.fontName.family === FAMILY).map((f) => f.fontName.style);
if (!available.length) throw new Error("Font 'Zalando Sans' is not available in this Figma.");
const norm = (s) => s.toLowerCase().replace(/[\s-]/g, "");
const pick = (...wants) => { for (const w of wants) { const hit = available.find((a) => norm(a) === norm(w)); if (hit) return hit; } return "Regular"; };
const W = { regular: pick("Regular"), medium: pick("Medium"), semibold: pick("SemiBold"), bold: pick("Bold"), xbold: pick("ExtraBold"), black: pick("Black") };
for (const s of new Set(Object.values(W))) await figma.loadFontAsync({ family: FAMILY, style: s });

// Palette (from the supplied colour sheet)
const C = {
  bg: "#F9FBFC", white: "#FFFFFF", heading: "#071437", t1: "#252F4A", t2: "#4B5675", t3: "#78829D", t4: "#99A1B7", t5: "#C4CADA",
  border: "#EBEDF3", lborder: "#F4F6F8", dbg: "#F5F6FA",
  p: "#2F50E4", p50: "#97A8F2", p30: "#C1CBF7", p20: "#D5DCFA", p15: "#E0E5FB", p10: "#EBEEFD", p5: "#F4F6FD", hover: "#4764E4", pressed: "#193EE4",
  info: "#1B84FF", info10: "#E9F3FF", info20: "#D1E6FF", info30: "#BBDBFF",
  ok: "#17C653", okA: "#04B440", ok10: "#E8FAEE",
  warn: "#F6B100", warnA: "#DFA000", warn10: "#FFF8E6",
  err: "#F8285A", errA: "#E82646", err10: "#FFEAEF",
};

const rgb = (h) => { h = h.replace("#", ""); const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255; return { r: n(0), g: n(2), b: n(4) }; };
const solid = (h, o = 1) => [{ type: "SOLID", color: rgb(h), opacity: o }];
const TF = { h: [[1, 0, 0], [0, 1, 0]], v: [[0, 1, 0], [-1, 0, 1]], d: [[0.5, 0.5, 0], [-0.5, 0.5, 0.5]] };
const grad = (stops, dir = "d") => [{
  type: "GRADIENT_LINEAR", gradientTransform: TF[dir],
  gradientStops: stops.map((s, i) => { const [hex, a = 1, pos] = Array.isArray(s) ? s : [s]; return { position: pos ?? i / (stops.length - 1), color: { ...rgb(hex), a } }; }),
}];
const radial = (stops) => [{
  type: "GRADIENT_RADIAL", gradientTransform: [[1, 0, 0], [0, 1, 0]],
  gradientStops: stops.map(([hex, a, pos]) => ({ position: pos, color: { ...rgb(hex), a } })),
}];
const shadow = (hex, a, y, radius, spread = 0) => ({ type: "DROP_SHADOW", color: { ...rgb(hex), a }, offset: { x: 0, y }, radius, spread, visible: true, blendMode: "NORMAL" });
const inner = (hex, a, x, y, radius) => ({ type: "INNER_SHADOW", color: { ...rgb(hex), a }, offset: { x, y }, radius, spread: 0, visible: true, blendMode: "NORMAL" });
const blur = (radius) => ({ type: "LAYER_BLUR", radius, visible: true });
const soft = () => [shadow(C.heading, 0.06, 8, 24), shadow(C.heading, 0.04, 1, 3)];

// ---- V1 on the canvas: photos and icons are reused from it when ISX / B64 are not injected ----
// (figma_execute runs carry no assets; design-run.js runs inject both and never need V1.)
const HAS_ISX = typeof ISX !== "undefined" && Object.keys(ISX).length > 0;
const HAS_B64 = typeof B64 !== "undefined";
const V1 = figma.currentPage.children.find((n) => n.name === "OfficeLoop · Shuttle booking flow · Light · Liquid Glass");
const V1_ICON = {}, V1_IMG = {};
if (V1) for (const n of V1.findAll((x) => x.name.startsWith("iconsax/") || ("fills" in x && Array.isArray(x.fills) && x.fills.some((f) => f.type === "IMAGE")))) {
  if (n.name.startsWith("iconsax/")) V1_ICON[n.name.slice(8)] ??= n;
  else V1_IMG[n.name] = n.fills.find((f) => f.type === "IMAGE").imageHash;
}
const PHOTO_LAYER = { "30004322": "Avatar", "1224759": "Next ride card", "29450986": "Vehicle", "19821492": "Office photo", "30767572": "Driver photo" };

// ---- Images ----
const HASH = {};
function imgFill(id, opacity = 1) {
  if (!HASH[id]) {
    if (HAS_B64 && B64[id]) HASH[id] = figma.createImage(figma.base64Decode(B64[id])).hash;
    else if (V1_IMG[PHOTO_LAYER[id]]) HASH[id] = V1_IMG[PHOTO_LAYER[id]];
    else throw new Error("Image not injected and not found in V1: " + id);
  }
  return [{ type: "IMAGE", imageHash: HASH[id], scaleMode: "FILL", opacity }];
}
const img = (id) => id;

// ---- Shapes ----
function smooth(n, r) { n.cornerRadius = r; if (r > 0) n.cornerSmoothing = 1; return n; }
function frame(parent, name, x, y, w, h, fills = [], r = 0) {
  const f = figma.createFrame(); parent.appendChild(f);
  f.name = name; f.x = x; f.y = y; f.resize(w, h); f.fills = fills; smooth(f, r); f.clipsContent = true;
  return f;
}
function rect(parent, name, x, y, w, h, fills, r = 0) {
  const n = figma.createRectangle(); parent.appendChild(n);
  n.name = name; n.x = x; n.y = y; n.resize(w, h); n.fills = fills; smooth(n, r);
  return n;
}
function ellipse(parent, name, x, y, w, h, fills) {
  const n = figma.createEllipse(); parent.appendChild(n);
  n.name = name; n.x = x; n.y = y; n.resize(w, h); n.fills = fills;
  return n;
}
function text(parent, str, x, y, o = {}) {
  const t = figma.createText(); parent.appendChild(t);
  t.fontName = { family: FAMILY, style: W[o.weight || "regular"] };
  t.characters = str;
  t.fontSize = o.size || 14;
  t.fills = solid(o.color || C.heading, o.opacity ?? 1);
  t.letterSpacing = { value: o.ls ?? 0, unit: "PIXELS" };
  if (o.lh) t.lineHeight = { value: o.lh, unit: "PIXELS" };
  if (o.w) { t.resize(o.w, t.height); t.textAutoResize = "HEIGHT"; }
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.upper) t.textCase = "UPPER";
  if (o.strike) t.textDecoration = "STRIKETHROUGH";
  t.x = x; t.y = y; t.name = o.name || str.slice(0, 40);
  return t;
}
function line(parent, name, x1, y1, x2, y2, color, weight = 2, dash) {
  const v = figma.createVector(); parent.appendChild(v);
  v.name = name;
  v.vectorPaths = [{ windingRule: "NONE", data: `M ${x1} ${y1} L ${x2} ${y2}` }];
  v.strokes = solid(color); v.strokeWeight = weight; v.strokeCap = "ROUND";
  if (dash) v.dashPattern = dash;
  return v;
}
function path(parent, name, d, color, weight = 4, o = {}) {
  const v = figma.createVector(); parent.appendChild(v);
  v.name = name;
  v.vectorPaths = [{ windingRule: "NONE", data: d }];
  v.strokes = solid(color, o.opacity ?? 1); v.strokeWeight = weight; v.strokeCap = "ROUND"; v.strokeJoin = "ROUND";
  v.fills = [];
  if (o.dash) v.dashPattern = o.dash;
  return v;
}

// ---- Iconsax ----
function recolor(n, color) {
  for (const k of ["fills", "strokes"]) if (k in n && Array.isArray(n[k]) && n[k].length) n[k] = n[k].map((p) => (p.type === "SOLID" ? { ...p, color: rgb(color) } : p));
  if ("children" in n) n.children.forEach((c) => recolor(c, color));
}
function icon(parent, key, x, y, size = 24, color = C.heading) {
  if (!HAS_ISX) {
    const src = V1_ICON[key];
    if (!src) throw new Error("Iconsax icon not injected and not in V1: " + key);
    const n = src.clone(); parent.appendChild(n);
    n.rescale(size / n.width); recolor(n, color);
    n.name = "iconsax/" + key; n.x = x; n.y = y;
    return n;
  }
  const body = ISX[key];
  if (!body) throw new Error("Iconsax icon not injected: " + key);
  const paint = key.endsWith("-linear") ? `fill="none"` : `fill="none"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${paint}>${body.replaceAll("currentColor", color).replaceAll("#292D32", color).replaceAll("#292d32", color)}</svg>`;
  const n = figma.createNodeFromSvg(svg); parent.appendChild(n);
  n.fills = []; n.clipsContent = false;
  n.name = "iconsax/" + key; n.x = x; n.y = y;
  return n;
}

// ---- Auto layout ----
function pad(f, p) {
  if (p === undefined) return;
  const [t, r, b, l] = typeof p === "number" ? [p, p, p, p] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p;
  f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l;
}
function sizing(n, h, v) { if (h) n.layoutSizingHorizontal = h; if (v) n.layoutSizingVertical = v; return n; }
function al(parent, name, dir, o = {}) {
  const f = figma.createFrame(); parent.appendChild(f);
  f.name = name; f.layoutMode = dir; f.fills = o.fills || [];
  f.itemSpacing = o.gap ?? 0; pad(f, o.pad);
  f.primaryAxisAlignItems = o.main || "MIN"; f.counterAxisAlignItems = o.cross || "MIN";
  f.clipsContent = o.clip ?? false;
  if (o.r) smooth(f, o.r);
  if (o.w || o.h) f.resize(o.w || 100, o.h || 100);
  sizing(f, o.sw || (o.w ? "FIXED" : "HUG"), o.sh || (o.h ? "FIXED" : "HUG"));
  if (o.stroke) { f.strokes = solid(o.stroke, o.strokeO ?? 1); f.strokeWeight = o.sw2 || 1; f.strokeAlign = "INSIDE"; }
  if (o.effects) f.effects = o.effects;
  if (o.wrap) { f.layoutWrap = "WRAP"; f.counterAxisSpacing = o.wrapGap ?? o.gap ?? 0; }
  return f;
}
const row = (p, name, o = {}) => al(p, name, "HORIZONTAL", o);
const col = (p, name, o = {}) => al(p, name, "VERTICAL", o);
function sp(parent, h, name = "spacer") { const f = figma.createFrame(); parent.appendChild(f); f.name = name; f.fills = []; f.resize(1, h); sizing(f, "FILL", "FIXED"); return f; }
function grow(parent) { const f = figma.createFrame(); parent.appendChild(f); f.name = "flex"; f.fills = []; f.resize(1, 1); f.layoutGrow = 1; return f; }
function absolute(n, x, y) { n.layoutPositioning = "ABSOLUTE"; n.x = x; n.y = y; return n; }
function t(parent, str, o = {}) { const n = text(parent, str, 0, 0, o); if (o.fill) sizing(n, "FILL", "HUG"); return n; }
function fill(n) { return sizing(n, "FILL", null); }

// Card: solid white surface, hairline border, soft shadow.
function card(parent, name, o = {}) {
  const f = al(parent, name, o.dir || "VERTICAL", { pad: o.pad ?? 16, gap: o.gap ?? 12, r: o.r ?? 22, fills: solid(o.fill || C.white), stroke: o.stroke ?? C.border, main: o.main, cross: o.cross, effects: o.flat ? [] : soft() });
  if (o.fillW !== false) fill(f);
  return f;
}

// ---- Liquid Glass (light) ----
let GLASS_OK = null;
function glassEffect(n, strong = false, button = false) {
  const base = button ? [] : [shadow(C.heading, strong ? 0.12 : 0.08, strong ? 12 : 8, strong ? 32 : 24), shadow(C.heading, 0.04, 1, 2)];
  if (GLASS_OK !== false) {
    try {
      n.effects = [...base, { type: "GLASS", visible: true, lightIntensity: 0.8, lightAngle: -45, refraction: strong ? 0.85 : 0.7, depth: strong ? 22 : 14, dispersion: 0.25, radius: strong ? 8 : 5 }];
      GLASS_OK = true; return;
    } catch (e) { GLASS_OK = false; }
  }
  n.effects = [...base, { type: "BACKGROUND_BLUR", radius: 24, visible: true }];
}
const glassFills = (tint = 0.6) => [{ type: "SOLID", color: rgb("#FFFFFF"), opacity: tint }, ...grad([["#FFFFFF", 0.55, 0], ["#FFFFFF", 0.05, 0.6]], "v")];
function glassStroke(f) {
  f.strokes = grad([["#FFFFFF", 1, 0], ["#FFFFFF", 0.4, 0.5], ["#FFFFFF", 0.9, 1]], "d");
  f.strokeWeight = 1.2; f.strokeAlign = "INSIDE";
}
function glassAL(parent, name, dir, o = {}) {
  const f = al(parent, name, dir, { ...o, fills: o.button ? solid("#FFFFFF", o.tint ?? 0.6) : glassFills(o.tint ?? 0.6) });
  if (o.button) { f.strokes = solid("#FFFFFF", 0.9); f.strokeWeight = 1; f.strokeAlign = "INSIDE"; } else glassStroke(f);
  glassEffect(f, o.strong, o.button);
  return f;
}
function glassBtn(parent, name, size, iconKey, color = C.heading, o = {}) {
  const b = glassAL(parent, name, "HORIZONTAL", { ...o, button: true, w: size, h: size, r: size / 2, main: "CENTER", cross: "CENTER" });
  icon(b, iconKey, 0, 0, o.iconSize || 22, color);
  return b;
}
// Primary pill button (tinted glass on primary).
function primaryBtn(parent, label, o = {}) {
  const b = row(parent, "Button/" + label, { pad: [0, 24], h: o.h || 56, gap: 10, r: (o.h || 56) / 2, main: "CENTER", cross: "CENTER",
    fills: solid(C.p) });
  t(b, label, { size: 17, weight: "semibold", color: C.white });
  if (o.icon) icon(b, o.icon, 0, 0, 20, C.white);
  if (o.fill !== false) sizing(b, "FILL", "FIXED");
  return b;
}
function chip(parent, label, on, o = {}) {
  const c = row(parent, "Chip/" + label + (on ? " (selected)" : ""), { pad: [9, 16], gap: 6, r: 20, cross: "CENTER",
    fills: on ? solid(C.p) : solid(C.white), stroke: on ? undefined : C.border, effects: [] });
  if (o.icon) icon(c, o.icon, 0, 0, 16, on ? C.white : C.t2);
  t(c, label, { size: 14, weight: on ? "semibold" : "medium", color: on ? C.white : C.t1 });
  return c;
}
function badge(parent, label, fg, bg, o = {}) {
  const b = row(parent, "Badge/" + label, { pad: [5, 10], gap: 5, r: 12, cross: "CENTER", fills: solid(bg) });
  if (o.dot) ellipse(b, "dot", 0, 0, 6, 6, solid(fg));
  if (o.icon) icon(b, o.icon, 0, 0, 14, fg);
  t(b, label, { size: 12, weight: "semibold", color: fg });
  return b;
}
// V2: tiles, tabs and toggles use outline icons; bold Iconsax shapes read as blobs at 20-24 px.
const outline = (key) => { const lin = key.replace(/-bold$/, "-linear"); return lin !== key && (HAS_ISX ? ISX[lin] : V1_ICON[lin]) ? lin : key; };
function iconTile(parent, key, fg, bg, size = 44, r = 14) {
  key = outline(key);
  const b = row(parent, "Icon tile", { w: size, h: size, r, main: "CENTER", cross: "CENTER", fills: solid(bg) });
  icon(b, key, 0, 0, Math.round(size * 0.5), fg);
  return b;
}
function divider(parent, color = C.border) { const d = rect(parent, "Divider", 0, 0, 10, 1, solid(color)); sizing(d, "FILL", "FIXED"); return d; }

// ---- Chrome ----
function screenAL(section, name, index) {
  const s = frame(section, name, 80 + index * 470, 200, 390, 844, solid(C.bg), 48);
  s.layoutMode = "VERTICAL"; s.primaryAxisAlignItems = "MIN"; s.counterAxisAlignItems = "MIN"; s.itemSpacing = 0;
  sizing(s, "FIXED", "FIXED"); s.clipsContent = true;
  s.effects = [shadow(C.heading, 0.10, 30, 60)];
  return s;
}
// Soft colour field behind the top of a screen, so glass has something to refract.
function backdrop(s, h = 360, hue = C.p) {
  absolute(rect(s, "Backdrop/wash", 0, 0, 390, h, grad([[C.p10, 1, 0], [C.bg, 1, 1]], "v")), 0, 0);
  const b1 = absolute(ellipse(s, "Backdrop/blob primary", 0, 0, 280, 220, solid(hue, 0.22)), -80, -60); b1.effects = [blur(70)];
  const b2 = absolute(ellipse(s, "Backdrop/blob info", 0, 0, 240, 200, solid(C.info, 0.18)), 220, 40); b2.effects = [blur(70)];
}
function statusBarAL(parent, color = C.heading) {
  const b = row(parent, "Status bar", { pad: [0, 34, 0, 40], main: "SPACE_BETWEEN", cross: "CENTER", h: 54 });
  sizing(b, "FILL", "FIXED");
  t(b, "9:41", { size: 17, weight: "semibold", color });
  const right = row(b, "Indicators", { gap: 6, cross: "CENTER" });
  const sig = row(right, "Signal", { gap: 2, cross: "MAX" });
  [4, 6.5, 9, 11.5].forEach((h) => rect(sig, "bar", 0, 0, 3, h, solid(color), 1));
  const bat = row(right, "Battery", { pad: 2, r: 4, w: 25, h: 12 });
  bat.strokes = solid(color, 0.35); bat.strokeWeight = 1;
  const lvl = rect(bat, "level", 0, 0, 19, 8, solid(color), 2); sizing(lvl, "FILL", "FILL");
  return b;
}
function homeIndicator(s) { absolute(rect(s, "Home indicator", 0, 0, 134, 5, solid(C.heading), 3), 128, 831); }
function tabBar(s, active) {
  const bar = glassAL(s, "Tab bar (Liquid Glass)", "HORIZONTAL", { pad: 6, r: 34, w: 358, h: 68, strong: true, tint: 0.62, cross: "CENTER" });
  absolute(bar, 16, 752);
  [["home2", "Home"], ["bus", "Book"], ["ticket", "My Rides"], ["profile-circle", "Profile"]].forEach(([k, label]) => {
    const on = label === active;
    const item = col(bar, "Tab/" + label, { gap: 3, main: "CENTER", cross: "CENTER", r: 28, fills: on ? solid(C.p10, 0.9) : [] });
    sizing(item, "FILL", "FILL");
    icon(item, k + "-linear", 0, 0, 24, on ? C.p : C.t3);
    t(item, label, { size: 11, weight: on ? "semibold" : "medium", color: on ? C.p : C.t3 });
  });
  homeIndicator(s);
  return bar;
}
// V2 nav header: glass back button, centred title with a 4-segment step bar (replaces "Step N of 4" text),
// optional right button.
function navBar(parent, title, rightIcon, step) {
  const n = row(parent, "Nav bar", { pad: [6, 20, 12, 20], main: "SPACE_BETWEEN", cross: "CENTER" });
  sizing(n, "FILL", "HUG");
  glassBtn(n, "Back", 44, "arrow-left-linear");
  const c = col(n, "Title", { cross: "CENTER", gap: 7 });
  t(c, title, { size: 17, weight: "semibold" });
  if (step) {
    const bar = row(c, "Steps", { gap: 4, cross: "CENTER" });
    for (let i = 1; i <= 4; i++) rect(bar, "Step " + i + (i === step ? " (current)" : ""), 0, 0, i === step ? 26 : 14, 4, solid(i <= step ? C.p : C.p20), 2);
  }
  if (rightIcon) glassBtn(n, "Action", 44, rightIcon);
  else { const g = row(n, "spacer", { w: 44, h: 44 }); }
  return n;
}
// V2 section header: one style everywhere (17 bold title, optional 13 medium hint or link on the right).
function sectionHead(parent, title, hint, link) {
  const h = row(parent, "Section/" + title, { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(h);
  t(h, title, { size: 17, weight: "bold", ls: -0.2 });
  if (hint) t(h, hint, { size: 13, weight: link ? "semibold" : "medium", color: link ? C.p : C.t3 });
  return h;
}
// V2 bottom bar summary: what the rider has chosen so far, above the single primary action.
function summary(parent, key, main, sub) {
  const r = row(parent, "Summary", { gap: 10, cross: "CENTER" }); fill(r);
  iconTile(r, key, C.p, C.p10, 36, 12);
  const tx = col(r, "t", { gap: 1 }); tx.layoutGrow = 1;
  t(tx, main, { size: 14, weight: "semibold" });
  if (sub) t(tx, sub, { size: 12, weight: "medium", color: C.t3 });
  return r;
}
// Bottom glass action bar holding content (absolute).
function bottomBar(s, h = 118) {
  const bar = glassAL(s, "Bottom bar (Liquid Glass)", "VERTICAL", { pad: [16, 20, 34, 20], gap: 12, r: 34, w: 390, h, strong: true, tint: 0.72 });
  absolute(bar, 0, 844 - h);
  bar.topLeftRadius = 34; bar.topRightRadius = 34; bar.bottomLeftRadius = 48; bar.bottomRightRadius = 48;
  return bar;
}
function stepper(parent, step, total = 4) {
  const r = row(parent, "Progress", { gap: 6, cross: "CENTER" });
  for (let i = 1; i <= total; i++) { const b = rect(r, "step " + i, 0, 0, i === step ? 22 : 8, 6, solid(i <= step ? C.p : C.p20), 3); }
  return r;
}

// Vector city map (roads, blocks, park, water) in a frame.
function cityMap(parent, name, w, h) {
  const m = frame(parent, name, 0, 0, w, h, solid("#EEF2F7"));
  // blocks
  const blocks = [[20, 30, 90, 70], [130, 20, 110, 60], [260, 40, 120, 90], [30, 140, 70, 110], [120, 110, 90, 80], [240, 160, 80, 70], [340, 150, 90, 100], [40, 280, 120, 70], [190, 260, 110, 90], [320, 290, 100, 60], [60, 380, 90, 90], [180, 390, 120, 70], [330, 380, 90, 110], [20, 500, 130, 80], [200, 490, 100, 90], [330, 520, 90, 80]];
  blocks.forEach(([x, y, bw, bh], i) => rect(m, "Block", x, y, bw, bh, solid("#E3E8F0"), 8));
  rect(m, "Park", 225, 250, 90, 100, solid("#DCF3E3"), 14);
  rect(m, "Park 2", 20, 400, 60, 90, solid("#DCF3E3"), 14);
  const water = path(m, "Lake", `M -20 ${h * 0.82} C 80 ${h * 0.76} 160 ${h * 0.9} ${w + 20} ${h * 0.8}`, "#D1E6FF", 36);
  // roads
  const roads = [`M -10 100 L ${w + 10} 90`, `M -10 235 C 120 230 200 215 ${w + 10} 245`, `M -10 370 L ${w + 10} 365`, `M 115 -10 L 105 ${h + 10}`, `M 225 -10 C 230 200 215 400 235 ${h + 10}`, `M 330 -10 L 320 ${h + 10}`, `M -10 480 L ${w + 10} 470`];
  roads.forEach((d, i) => { path(m, "Road casing", d, "#DDE3EC", 14); path(m, "Road", d, "#FFFFFF", 10); });
  path(m, "Highway casing", `M -10 ${h * 0.62} C 120 ${h * 0.58} 260 ${h * 0.66} ${w + 10} ${h * 0.6}`, "#F6DFA0", 18);
  path(m, "Highway", `M -10 ${h * 0.62} C 120 ${h * 0.58} 260 ${h * 0.66} ${w + 10} ${h * 0.6}`, "#FDE8B3", 13);
  return m;
}
function pin(parent, x, y, color, key = "location-bold", size = 40) {
  const p = frame(parent, "Pin", x - size / 2, y - size / 2, size, size, solid(color), size / 2);
  p.strokes = solid(C.white); p.strokeWeight = 3; p.strokeAlign = "OUTSIDE"; p.effects = [shadow(color, 0.4, 6, 14)];
  p.clipsContent = false;
  icon(p, key, size / 2 - 10, size / 2 - 10, 20, C.white);
  return p;
}
function dotPin(parent, x, y, color, r = 8) {
  const halo = ellipse(parent, "Halo", x - r * 2.5, y - r * 2.5, r * 5, r * 5, solid(color, 0.16));
  const d = ellipse(parent, "Dot", x - r, y - r, r * 2, r * 2, solid(color)); d.strokes = solid(C.white); d.strokeWeight = 3; d.effects = [shadow(color, 0.35, 3, 8)];
  return d;
}
// Sample QR code: deterministic pseudo-random module grid with three finder squares.
function qr(parent, size = 168) {
  const q = frame(parent, "QR code (sample)", 0, 0, size, size, solid(C.white), 0);
  const n = 25, m = size / n;
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const finder = (cx, cy) => cx < 8 && cy < 8 || cx >= n - 8 && cy < 8 || cx < 8 && cy >= n - 8;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!finder(x, y) && rnd() > 0.52) rect(q, "m", x * m, y * m, m, m, solid(C.heading));
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([fx, fy]) => {
    const o = rect(q, "finder", fx * m, fy * m, 7 * m, 7 * m, [], m * 1.6); o.strokes = solid(C.heading); o.strokeWeight = m; o.strokeAlign = "INSIDE";
    rect(q, "finder core", (fx + 2) * m, (fy + 2) * m, 3 * m, 3 * m, solid(C.p), m);
  });
  const lg = frame(q, "Logo", size / 2 - 18, size / 2 - 18, 36, 36, solid(C.p), 10);
  lg.strokes = solid(C.white); lg.strokeWeight = 4; lg.strokeAlign = "OUTSIDE";
  icon(lg, "bus-bold", 8, 8, 20, C.white);
  return q;
}
