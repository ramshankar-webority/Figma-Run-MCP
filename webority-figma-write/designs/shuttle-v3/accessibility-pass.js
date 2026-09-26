// OfficeLoop V3: copies a V2 section and applies the fixes design_review found, in one undo step.
// Run through figma_execute with SRC set to the V2 section id (booking flow 2011:2, passes 2012:1632,
// onboarding 2012:2275). Standalone: needs no preamble.
//   const SRC = "2011:2";  <- prepend this line
//
// Fixes: text contrast to WCAG AA against the text's real background (shared token map first, then the
// nearest passing shade), text under 12 px raised to 12, overflowing text wraps, and the pass gradient's
// light end darkened so white text on it passes.

const TOKENS = {
  "#78829d": "#626a80", // t3 secondary text: 3.32 -> 4.67
  "#99a1b7": "#646978", // t4 placeholder and dim text: 2.23 -> 4.74
  "#c4cada": "#676a72", // t5
  "#04b440": "#037b2c", // okA success text
  "#17c653": "#0e7a33", // ok
  "#e82646": "#ce223e", // errA
  "#dfa000": "#896300", // warnA
};
const GRADIENT_END = { from: "#1b84ff", to: "#1d6fe0" }; // white text on it: 3.63 -> 4.77

const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const lum = ({ r, g, b }) => { const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const over = (t, a, b) => ({ r: t.r * a + b.r * (1 - a), g: t.g * a + b.g * (1 - a), b: t.b * a + b.b * (1 - a) });

function paintRGBA(p) {
  if (!p || p.visible === false) return null;
  if (p.type === "SOLID") return { ...p.color, a: p.opacity ?? 1 };
  if (p.type.startsWith("GRADIENT")) {
    const s = p.gradientStops, m = (k) => s.reduce((t, x) => t + x.color[k], 0) / s.length;
    return { r: m("r"), g: m("g"), b: m("b"), a: m("a") * (p.opacity ?? 1) };
  }
  if (p.type === "IMAGE") return { image: true };
  return null;
}
function background(node) {
  const layers = [];
  for (let n = node.parent; n && n.type !== "PAGE"; n = n.parent) {
    const fills = "fills" in n && Array.isArray(n.fills) ? n.fills : [];
    for (let j = fills.length - 1; j >= 0; j--) {
      const c = paintRGBA(fills[j]);
      if (!c) continue;
      if (c.image) return null;
      layers.push(c);
      if (c.a >= 0.99) { let col = c; for (let k = layers.length - 2; k >= 0; k--) col = over(layers[k], layers[k].a, col); return col; }
    }
  }
  return { r: 1, g: 1, b: 1 };
}

const src = await figma.getNodeByIdAsync(SRC);
if (!src) throw new Error("Source section not found: " + SRC);
const page = src.parent;
let maxY = 0;
for (const n of page.children) if ("y" in n) maxY = Math.max(maxY, n.y + n.height);
const v3 = src.clone();
page.appendChild(v3);
v3.x = src.x; v3.y = Math.round(maxY + 200);
v3.name = src.name.includes("V2") ? src.name.replace("V2", "V3") : src.name + " · V3";

const out = { section: v3.id, name: v3.name, gradients: 0, textSize: 0, contrast: 0, contrastUnfixed: [], overflow: 0, tokens: {} };
const texts = v3.findAll((n) => n.type === "TEXT");
for (const t of texts) if (t.fontName !== figma.mixed) await figma.loadFontAsync(t.fontName);

// Section header: V2 badge and subtitle
for (const t of texts) {
  if (t.parent && t.parent.name === "Version" && t.characters === "V2") t.characters = "V3";
  if (t.parent === v3 && t.y > 90 && t.y < 130) t.characters = "V3 accessibility pass: every text 4.5:1 or better on its real background, 12 px minimum, no overflow. " + t.characters;
}

// 1. Pass gradient
for (const n of v3.findAll((x) => "fills" in x && Array.isArray(x.fills) && x.fills.some((p) => p.type === "GRADIENT_LINEAR"))) {
  let hit = false;
  n.fills = n.fills.map((p) => {
    if (p.type !== "GRADIENT_LINEAR") return p;
    return { ...p, gradientStops: p.gradientStops.map((s) => (hex(s.color) === GRADIENT_END.from ? ((hit = true), { ...s, color: { ...rgb(GRADIENT_END.to), a: s.color.a } }) : s)) };
  });
  if (hit) out.gradients++;
}

// 2. Minimum text size (screens only, not the section header)
for (const t of texts) if (t.parent !== v3 && typeof t.fontSize === "number" && t.fontSize < 12) { t.fontSize = 12; out.textSize++; }

// 3. Contrast, against the real background
for (const t of texts) {
  if (!t.characters.trim() || t.fills === figma.mixed || !t.fills.length || t.fills[0].type !== "SOLID") continue;
  const bg = background(t);
  if (!bg) continue; // over a photo: judged by eye
  const f = t.fills[0];
  const fg = (f.opacity ?? 1) < 0.99 ? over(f.color, f.opacity, bg) : f.color;
  const size = typeof t.fontSize === "number" ? t.fontSize : 14;
  const bold = t.fontName !== figma.mixed && /bold|black|semi/i.test(t.fontName.style);
  const need = size >= 18 || (size >= 14 && bold) ? 3 : 4.5;
  if (ratio(fg, bg) >= need) continue;
  const from = hex(f.color);
  let c = TOKENS[from] ? rgb(TOKENS[from]) : { ...f.color };
  if (ratio(c, bg) < need) {
    const lighten = lum(c) > lum(bg);
    for (let i = 0; i < 80 && ratio(c, bg) < need; i++) c = lighten ? { r: c.r + (1 - c.r) * 0.1, g: c.g + (1 - c.g) * 0.1, b: c.b + (1 - c.b) * 0.1 } : { r: c.r * 0.97, g: c.g * 0.97, b: c.b * 0.97 };
  }
  if (ratio(c, bg) < need) { out.contrastUnfixed.push(t.id + " " + t.characters.slice(0, 30)); continue; }
  t.fills = [{ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: 1 }];
  out.contrast++;
  const key = from + "->" + hex(c);
  out.tokens[key] = (out.tokens[key] || 0) + 1;
}

// 4. Overflow: text wider than its parent wraps inside it
for (const t of texts) {
  const p = t.parent, a = t.absoluteBoundingBox, b = p && p.absoluteBoundingBox;
  if (!a || !b || p === v3) continue;
  if (a.x + a.width <= b.x + b.width + 1 && a.x >= b.x - 1) continue;
  if ("layoutMode" in p && p.layoutMode !== "NONE") { t.textAutoResize = "HEIGHT"; t.layoutSizingHorizontal = "FILL"; }
  else { t.textAutoResize = "HEIGHT"; t.resize(Math.max(20, b.x + b.width - a.x), t.height); }
  out.overflow++;
}
return out;
