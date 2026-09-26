// v2 helpers: Bricolage Grotesque, Iconsax icons (ISX injected), Pexels photos (B64 injected),
// iOS Liquid Glass (Figma GLASS effect, with a frosted fallback) and 100% corner smoothing.

// ---- Font: resolve real style names for Bricolage Grotesque in this Figma ----
const FAMILY = "Bricolage Grotesque";
const available = (await figma.listAvailableFontsAsync()).filter((f) => f.fontName.family === FAMILY).map((f) => f.fontName.style);
if (!available.length) throw new Error("Font 'Bricolage Grotesque' is not available in this Figma. Install it from Google Fonts, then retry.");
const norm = (s) => s.toLowerCase().replace(/[\s-]/g, "");
const pick = (...wants) => { for (const w of wants) { const hit = available.find((a) => norm(a) === norm(w)); if (hit) return hit; } return available.includes("Regular") ? "Regular" : available[0]; };
const W = { regular: pick("Regular"), medium: pick("Medium", "Regular"), semibold: pick("SemiBold", "Semi Bold", "Medium"), bold: pick("Bold", "SemiBold"), xbold: pick("ExtraBold", "Extra Bold", "Bold") };
for (const s of new Set(Object.values(W))) await figma.loadFontAsync({ family: FAMILY, style: s });

const C = { bg: "#07070C", text: "#FFFFFF", muted: "#A6A6BD", dim: "#74748A", pink: "#FF4D8D", violet: "#8B5CF6", cyan: "#38E1FF" };

const rgb = (h) => { h = h.replace("#", ""); const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255; return { r: n(0), g: n(2), b: n(4) }; };
const solid = (h, o = 1) => [{ type: "SOLID", color: rgb(h), opacity: o }];
const TF = { h: [[1, 0, 0], [0, 1, 0]], v: [[0, 1, 0], [-1, 0, 1]], d: [[0.5, 0.5, 0], [-0.5, 0.5, 0.5]], dr: [[-0.5, 0.5, 0.5], [-0.5, -0.5, 1]] };
const grad = (stops, dir = "d") => [{
  type: "GRADIENT_LINEAR", gradientTransform: TF[dir],
  gradientStops: stops.map((s, i) => { const [hex, a = 1, pos] = Array.isArray(s) ? s : [s]; return { position: pos ?? i / (stops.length - 1), color: { ...rgb(hex), a } }; }),
}];
const shadow = (hex, a, y, radius, spread = 0) => ({ type: "DROP_SHADOW", color: { ...rgb(hex), a }, offset: { x: 0, y }, radius, spread, visible: true, blendMode: "NORMAL" });
const inner = (hex, a, x, y, radius) => ({ type: "INNER_SHADOW", color: { ...rgb(hex), a }, offset: { x, y }, radius, spread: 0, visible: true, blendMode: "NORMAL" });
const blur = (radius) => ({ type: "LAYER_BLUR", radius, visible: true });

// ---- Images ----
const HASH = {};
function imgFill(id, opacity = 1) {
  if (!B64[id]) throw new Error("Image not injected: " + id);
  if (!HASH[id]) HASH[id] = figma.createImage(figma.base64Decode(B64[id])).hash;
  return [{ type: "IMAGE", imageHash: HASH[id], scaleMode: "FILL", opacity }];
}
const img = (id) => id; // marker the runner scans for, e.g. img("7315881")

// ---- Shapes (corner smoothing 100% everywhere a radius exists) ----
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
function photo(parent, name, id, x, y, w, h, r = 0) { return rect(parent, name, x, y, w, h, imgFill(id), r); }

function text(parent, str, x, y, o = {}) {
  const t = figma.createText(); parent.appendChild(t);
  t.fontName = { family: FAMILY, style: W[o.weight || "regular"] };
  t.characters = str;
  t.fontSize = o.size || 14;
  t.fills = solid(o.color || C.text, o.opacity ?? 1);
  t.letterSpacing = { value: o.ls ?? 0, unit: "PIXELS" };
  if (o.lh) t.lineHeight = { value: o.lh, unit: "PIXELS" };
  if (o.w) { t.resize(o.w, t.height); t.textAutoResize = "HEIGHT"; }
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.upper) t.textCase = "UPPER";
  t.x = x; t.y = y; t.name = o.name || str.slice(0, 40);
  return t;
}

// ---- Iconsax ----
function icon(parent, key, x, y, size = 24, color = C.text) {
  const body = ISX[key];
  if (!body) throw new Error("Iconsax icon not injected: " + key);
  // Iconify bodies inherit paint from the root <svg>: linear icons are strokes, bold/outline are fills.
  const paint = key.endsWith("-linear") ? `fill="none" stroke="${color}"` : `fill="${color}"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${paint}>${body.replaceAll("currentColor", color)}</svg>`;
  const n = figma.createNodeFromSvg(svg); parent.appendChild(n);
  n.fills = []; n.clipsContent = false;
  n.name = "iconsax/" + key; n.x = x; n.y = y;
  return n;
}

// ---- Liquid Glass ----
let GLASS_OK = null;
function glassEffect(n, strong = false) {
  const effects = [shadow("#000000", 0.28, 10, 30)];
  if (GLASS_OK !== false) {
    try {
      n.effects = [...effects, { type: "GLASS", visible: true, lightIntensity: 0.6, lightAngle: -45, refraction: strong ? 0.9 : 0.75, depth: strong ? 24 : 16, dispersion: 0.35, radius: strong ? 6 : 4 }];
      GLASS_OK = true;
      return;
    } catch (e) { GLASS_OK = false; }
  }
  // Fallback: frosted glass look.
  n.effects = [...effects, { type: "BACKGROUND_BLUR", radius: 24, visible: true }, inner("#FFFFFF", 0.35, 0, 1, 1), inner("#FFFFFF", 0.1, 0, -8, 18)];
}
function glass(parent, name, x, y, w, h, r, o = {}) {
  const f = frame(parent, name, x, y, w, h, [
    { type: "SOLID", color: rgb("#FFFFFF"), opacity: o.tint ?? 0.1 },
    ...grad([["#FFFFFF", 0.14, 0], ["#FFFFFF", 0, 0.55]], "v"),
  ], r);
  f.clipsContent = false;
  f.strokes = grad([["#FFFFFF", 0.7, 0], ["#FFFFFF", 0.12, 0.45], ["#FFFFFF", 0.35, 1]], "d");
  f.strokeWeight = 1; f.strokeAlign = "INSIDE";
  glassEffect(f, o.strong);
  return f;
}
function glassCircle(parent, name, x, y, size, o = {}) { return glass(parent, name, x, y, size, size, size / 2, o); }

// ---- Common chrome ----
function statusBar(parent, color = C.text) {
  const g = frame(parent, "Status bar", 0, 0, 390, 50, []);
  text(g, "9:41", 36, 16, { size: 16, weight: "semibold", color });
  [4, 7, 10, 13].forEach((h, i) => rect(g, "signal", 292 + i * 5.5, 31 - h, 3.5, h, solid(color), 1));
  const bat = rect(g, "battery", 322, 17, 25, 13, [], 4); bat.strokes = solid(color, 0.4); bat.strokeWeight = 1;
  rect(g, "battery level", 324, 19, 19, 9, solid(color), 2);
  rect(g, "battery cap", 348.5, 21.5, 1.6, 4, solid(color, 0.4), 1);
  return g;
}
function tabBar(parent, active) {
  const bar = glass(parent, "Tab bar (Liquid Glass)", 16, 758, 358, 66, 33, { strong: true, tint: 0.08 });
  const items = [["home-2", "Home"], ["search-normal-1", "Search"], ["music-library-2", "Library"], ["profile-circle", "Profile"]];
  items.forEach(([k, label], i) => {
    const cx = 45 + i * 89.3;
    const on = k === active;
    if (on) { const pill = rect(bar, "active pill", cx - 38, 6, 76, 54, solid("#FFFFFF", 0.14), 27); }
    icon(bar, k + (on ? "-bold" : "-linear"), cx - 12, 12, 24, on ? C.text : C.muted);
    text(bar, label, cx - 36, 39, { size: 11, weight: on ? "semibold" : "medium", color: on ? C.text : C.muted, w: 72, align: "CENTER" });
  });
  rect(parent, "home indicator", 128, 832, 134, 5, solid("#FFFFFF", 0.9), 3);
  return bar;
}
function screen(section, name, index) {
  return frame(section, name, 80 + index * 470, 160, 390, 844, solid(C.bg), 48);
}

// ---- Auto layout helpers (v3) ----
// al(): auto-layout frame. Sizing is applied after it is appended, because FILL needs an auto-layout parent.
function pad(f, p) {
  if (p === undefined) return;
  const [t, r, b, l] = typeof p === "number" ? [p, p, p, p] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p;
  f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l;
}
function sizing(n, h, v) {
  if (h) n.layoutSizingHorizontal = h;
  if (v) n.layoutSizingVertical = v;
  return n;
}
function al(parent, name, dir, o = {}) {
  const f = figma.createFrame(); parent.appendChild(f);
  f.name = name; f.layoutMode = dir; f.fills = o.fills || [];
  f.itemSpacing = o.gap ?? 0; pad(f, o.pad);
  f.primaryAxisAlignItems = o.main || "MIN"; f.counterAxisAlignItems = o.cross || "MIN";
  f.clipsContent = o.clip ?? false;
  if (o.r) smooth(f, o.r);
  if (o.w || o.h) f.resize(o.w || 100, o.h || 100);
  const inAL = "layoutMode" in parent && parent.layoutMode !== "NONE";
  sizing(f, o.sw || (o.w ? "FIXED" : inAL ? "HUG" : "HUG"), o.sh || (o.h ? "FIXED" : "HUG"));
  return f;
}
const row = (p, name, o = {}) => al(p, name, "HORIZONTAL", o);
const col = (p, name, o = {}) => al(p, name, "VERTICAL", o);
function sp(parent, h, name = "spacer") { const f = figma.createFrame(); parent.appendChild(f); f.name = name; f.fills = []; f.resize(1, h); sizing(f, "FILL", "FIXED"); return f; }
function absolute(n, x, y) { n.layoutPositioning = "ABSOLUTE"; n.x = x; n.y = y; return n; }
function t(parent, str, o = {}) {
  const n = text(parent, str, 0, 0, o);
  if (o.fill) sizing(n, "FILL", "HUG");
  return n;
}
// Liquid Glass auto-layout container.
function glassAL(parent, name, dir, o = {}) {
  const f = al(parent, name, dir, { ...o, fills: [{ type: "SOLID", color: rgb("#FFFFFF"), opacity: o.tint ?? 0.1 }, ...grad([["#FFFFFF", 0.14, 0], ["#FFFFFF", 0, 0.55]], "v")] });
  f.strokes = grad([["#FFFFFF", 0.7, 0], ["#FFFFFF", 0.12, 0.45], ["#FFFFFF", 0.35, 1]], "d");
  f.strokeWeight = 1; f.strokeAlign = "INSIDE";
  glassEffect(f, o.strong);
  return f;
}
function glassBtn(parent, name, size, iconKey, color = C.text, o = {}) {
  const b = glassAL(parent, name, "HORIZONTAL", { ...o, w: size, h: size, r: size / 2, main: "CENTER", cross: "CENTER" });
  icon(b, iconKey, 0, 0, o.iconSize || 24, color);
  return b;
}
function photoAL(parent, name, id, w, h, r = 0) {
  const n = rect(parent, name, 0, 0, w, h, imgFill(id), r);
  return n;
}
function screenAL(section, name, index) {
  const s = frame(section, name, 80 + index * 470, 160, 390, 844, solid(C.bg), 48);
  s.layoutMode = "VERTICAL"; s.primaryAxisAlignItems = "MIN"; s.counterAxisAlignItems = "MIN"; s.itemSpacing = 0;
  sizing(s, "FIXED", "FIXED"); s.clipsContent = true;
  return s;
}
function statusBarAL(parent, color = C.text) {
  const b = row(parent, "Status bar", { pad: [0, 36, 0, 36], main: "SPACE_BETWEEN", cross: "CENTER", h: 50 });
  sizing(b, "FILL", "FIXED");
  t(b, "9:41", { size: 16, weight: "semibold", color });
  const right = row(b, "Indicators", { gap: 6, cross: "CENTER" });
  const sig = row(right, "Signal", { gap: 2, cross: "MAX" });
  [4, 7, 10, 13].forEach((h) => rect(sig, "bar", 0, 0, 3.5, h, solid(color), 1));
  const bat = row(right, "Battery", { pad: 2, r: 4, w: 25, h: 13 });
  bat.strokes = solid(color, 0.4); bat.strokeWeight = 1;
  const lvl = rect(bat, "level", 0, 0, 19, 9, solid(color), 2); sizing(lvl, "FILL", "FILL");
  return b;
}
function tabBarAL(parent, active) {
  const bar = glassAL(parent, "Tab bar (Liquid Glass)", "HORIZONTAL", { pad: 6, gap: 0, r: 33, h: 66, strong: true, tint: 0.08, cross: "CENTER" });
  sizing(bar, "FILL", "FIXED");
  [["home-2", "Home"], ["search-normal-1", "Search"], ["music-library-2", "Library"], ["profile-circle", "Profile"]].forEach(([k, label]) => {
    const on = k === active;
    const item = col(bar, "Tab/" + label, { gap: 3, main: "CENTER", cross: "CENTER", r: 27, fills: on ? solid("#FFFFFF", 0.14) : [] });
    sizing(item, "FILL", "FILL");
    icon(item, k + (on ? "-bold" : "-linear"), 0, 0, 24, on ? C.text : C.muted);
    t(item, label, { size: 11, weight: on ? "semibold" : "medium", color: on ? C.text : C.muted });
  });
  return bar;
}
function homeIndicator(s) { absolute(rect(s, "Home indicator", 0, 0, 134, 5, solid("#FFFFFF", 0.9), 3), 128, 832); }
