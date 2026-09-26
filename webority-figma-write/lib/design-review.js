// Design review engine: hard, explainable checks over a serialized Figma tree (plugin get_node or a
// snapshot), scored per category and tied to the persona who owns each rule. Laya, when on, answers the
// one bulk judgement a rule cannot: which ambiguous layers are tappable controls.

import { PERSONAS } from "./design-personas.js";
import { isTokenColor } from "./color-tokens.js";

export const CATEGORIES = {
  accessibility: { persona: "accessibility", title: "Accessibility" },
  visual: { persona: "visual", title: "Visual and type" },
  hierarchy: { persona: "interaction", title: "Hierarchy and actions" },
  content: { persona: "writer", title: "Content" },
  systems: { persona: "systems", title: "Design system" },
};
const INTERACTIVE = /\b(button|btn|cta|tab|chip|toggle|switch|radio|checkbox|check box|link|back|close|menu|key|segment|pill|fab|action|swap|next|edit|filter|share|notifications?)\b/i;
// Icons, badges and icon tiles are never the target: the control that holds them is.
const NOT_A_TARGET = /^(iconsax\/|icon\/|Badge\/|Icon tile$)/i;
const PLACEHOLDER = /\b(lorem|ipsum|todo|tbd|xxx+|placeholder|sample text|dummy)\b/i;

// ---- colour ----
const hexToRgb = (h) => { h = String(h).replace("#", ""); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }; };
const lum = ({ r, g, b }) => { const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const over = (top, a, bottom) => ({ r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a) });

// Colour of one visible paint, or null for an image. Gradients use the mean of their stops (approximate).
function paintColor(p) {
  if (!p || p.visible === false) return null;
  if (p.type === "SOLID" && p.color) { const c = hexToRgb(p.color); return { ...c, a: c.a * (p.opacity ?? 1), approx: false }; }
  if (p.type && p.type.startsWith("GRADIENT") && p.stops && p.stops.length) {
    const cs = p.stops.map((s) => hexToRgb(s.color));
    const m = (k) => cs.reduce((s, c) => s + c[k], 0) / cs.length;
    return { r: m("r"), g: m("g"), b: m("b"), a: m("a") * (p.opacity ?? 1), approx: true };
  }
  if (p.type === "IMAGE") return { image: true };
  return null;
}
// Background behind a node: composite the fills of its ancestors from the nearest opaque one upward.
function backgroundOf(ancestors) {
  const layers = [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const fills = Array.isArray(ancestors[i].fills) ? ancestors[i].fills : [];
    for (let j = fills.length - 1; j >= 0; j--) {
      const c = paintColor(fills[j]);
      if (!c) continue;
      if (c.image) return { unknown: true };
      layers.push(c);
      if (c.a >= 0.99) {
        let col = { r: c.r, g: c.g, b: c.b }, approx = c.approx;
        for (let k = layers.length - 2; k >= 0; k--) { col = over(layers[k], layers[k].a, col); approx = approx || layers[k].approx; }
        return { ...col, approx };
      }
    }
  }
  return { r: 1, g: 1, b: 1, approx: true }; // canvas white
}

function walkTree(node, fn, ancestors = []) {
  if (!node || node.visible === false) return;
  fn(node, ancestors);
  for (const c of node.children || []) walkTree(c, fn, [...ancestors, node]);
}
const isPhone = (n) => n.type === "FRAME" && n.width >= 300 && n.width <= 460 && n.height >= 560 && n.height <= 1000;
export function screensOf(root) {
  if (isPhone(root)) return [root];
  const out = [];
  const visit = (n, d) => { if (d > 3) return; for (const c of n.children || []) { if (isPhone(c)) out.push(c); else visit(c, d + 1); } };
  visit(root, 0);
  return out.length ? out : [root];
}
const saturation = (hex) => { const { r, g, b } = hexToRgb(hex); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };

// Candidates the name rules cannot settle, for Laya to judge (small framed things with content).
export function ambiguousTargets(root) {
  const out = [];
  walkTree(root, (n) => {
    if (!(n.type === "FRAME" || n.type === "INSTANCE" || n.type === "COMPONENT")) return;
    if (INTERACTIVE.test(n.name) || NOT_A_TARGET.test(n.name) || !n.children || !n.children.length) return;
    if (n.width < 16 || n.height < 16 || n.width > 120 || n.height > 72) return;
    // Only visible containers: a wrapper with no fill and no stroke is layout, not a control.
    const visible = (Array.isArray(n.fills) && n.fills.some((p) => p.visible !== false)) || (Array.isArray(n.strokes) && n.strokes.length);
    if (!visible) return;
    const texts = [];
    walkTree(n, (d) => { if (d.type === "TEXT" && d.text) texts.push(d.text.characters); });
    out.push({ id: n.id, state: { layer: n.name, size: `${n.width}x${n.height}`, text: texts.join(" ").slice(0, 80) || "none", rounded: n.cornerRadius ? "yes" : "no", filled: Array.isArray(n.fills) && n.fills.length ? "yes" : "no" } });
  });
  return out.slice(0, 60);
}

export function reviewTree(root, { grid = 4, minText = 12, minTarget = 44, tappable = new Set() } = {}) {
  const findings = [];
  const screens = screensOf(root);
  const screenOf = new Map();
  for (const s of screens) walkTree(s, (n) => screenOf.set(n.id, s));
  const inScreens = screens.length > 1 || screens[0] !== root;
  const add = (severity, category, rule, n, detail, fix) => {
    if (inScreens && n !== root && !screenOf.has(n.id)) return; // section labels and notes are not app UI
    findings.push({ severity, category, rule, persona: CATEGORIES[category].persona, layer: { id: n.id, name: n.name }, screen: screenOf.get(n.id)?.name, detail, fix });
  };
  // Scores are pass rates: every rule counts what it checked, so 90 findings over 900 texts is not a zero.
  const checked = {}, issues = {};
  const tick = (rule, n = 1) => (checked[rule] = (checked[rule] || 0) + n);
  const fontSizes = new Map(), families = new Set(), colors = new Set(), spacingOff = [], pairs = new Map();

  walkTree(root, (n, anc) => {
    for (const p of Array.isArray(n.fills) ? n.fills : []) if (p.type === "SOLID" && p.color && n.type !== "TEXT") colors.add(p.color.slice(0, 7).toLowerCase());
    if (n.type === "TEXT" && n.text) {
      const t = n.text, size = typeof t.fontSize === "number" ? t.fontSize : null;
      const chars = String(t.characters || "");
      if (!chars.trim()) return;
      if (size) fontSizes.set(size, (fontSizes.get(size) || 0) + 1);
      if (t.fontName && t.fontName.family) families.add(t.fontName.family);
      if (size) { tick("min-text-size"); if (size < minText) add("warn", "accessibility", "min-text-size", n, `${size} px text "${chars.slice(0, 40)}"`, `Raise to ${minText} px or more.`); }
      // Contrast, grouped by text colour so a failing token shows up once with a fix.
      const inkPaint = Array.isArray(n.fills) ? n.fills.find((p) => p.visible !== false) : null;
      const ink = paintColor(inkPaint);
      if (ink && !ink.image) {
        const bg = backgroundOf(anc);
        if (!bg.unknown) {
          tick("contrast");
          const fg = ink.a < 0.99 ? over(ink, ink.a, bg) : ink;
          const ratio = contrast(fg, bg);
          const bold = t.fontName && /bold|black|heavy|semi/i.test(t.fontName.style || "");
          const large = size && (size >= 18 || (size >= 14 && bold));
          const need = large ? 3 : 4.5;
          if (ratio < need) {
            add(ratio < need - 1 ? "fail" : "warn", "accessibility", "contrast", n, `Contrast ${ratio.toFixed(2)}:1, needs ${need}:1${bg.approx ? " (background estimated)" : ""}`, "Darken the text or lighten the background.");
            const key = inkPaint.color ? inkPaint.color.slice(0, 7).toLowerCase() : "gradient";
            const g = pairs.get(key) || { color: key, count: 0, worst: 99, bgs: [] };
            g.count++; g.worst = Math.min(g.worst, ratio); g.bgs.push(bg); pairs.set(key, g);
          }
        }
      }
      const parent = anc[anc.length - 1];
      if (parent && n.abs && parent.abs) {
        tick("text-overflow");
        if (n.abs.x + n.abs.width > parent.abs.x + parent.abs.width + 1 || n.abs.x < parent.abs.x - 1) add("fail", "visual", "text-overflow", n, `"${chars.slice(0, 40)}" runs outside ${parent.name}`, "Let it wrap, shorten it, or give it a fill width.");
      }
      tick("placeholder-copy"); tick("all-caps");
      if (PLACEHOLDER.test(chars)) add("warn", "content", "placeholder-copy", n, `Placeholder copy "${chars.slice(0, 40)}"`, "Replace with real content.");
      if (chars.length > 24 && chars === chars.toUpperCase() && /[A-Z]/.test(chars)) add("info", "content", "all-caps", n, "Long all-caps text is slower to read", "Use sentence case.");
    }
    if (n.layout && grid) {
      tick("spacing-grid");
      const vals = [n.layout.gap, ...Object.values(n.layout.padding || {})].filter((v) => typeof v === "number" && v > 0);
      if (vals.some((v) => v % grid !== 0)) spacingOff.push(n);
    }
  });

  // Touch targets: name rules plus Laya's picks; a target inside a passing target is fine.
  const passing = new Set();
  walkTree(root, (n, anc) => {
    if (NOT_A_TARGET.test(n.name)) return;
    const interactive = INTERACTIVE.test(n.name) || tappable.has(n.id);
    if (!interactive || !(n.type === "FRAME" || n.type === "INSTANCE" || n.type === "COMPONENT")) return;
    if (Math.min(n.width, n.height) < 12 || (inScreens && !screenOf.has(n.id))) return; // bars and strokes, labels outside screens
    if (anc.some((a) => passing.has(a.id))) return;
    const parent = anc[anc.length - 1];
    if (parent && parent !== screenOf.get(n.id) && parent.layout && parent.width >= minTarget * 3 && parent.height >= minTarget) { passing.add(n.id); return; } // the row is the target
    tick("touch-target");
    const short = Math.min(n.width, n.height), long = Math.max(n.width, n.height);
    if (short >= minTarget || (long >= minTarget && short >= 36)) { passing.add(n.id); return; }
    // A target only Laya identified is a suggestion, so it can warn but never fail.
    const lay = tappable.has(n.id) && !INTERACTIVE.test(n.name);
    add(short < 32 && !lay ? "fail" : "warn", "accessibility", "touch-target", n, `${n.width}x${n.height} tap area${tappable.has(n.id) ? " (Laya: tappable)" : ""}`, `Make the hit area at least ${minTarget}x${minTarget}.`);
  });

  // Competing primary actions per screen: saturated filled buttons.
  for (const s of screens) {
    tick("competing-primary");
    const primaries = [];
    walkTree(s, (n) => {
      if (!/button|cta/i.test(n.name) || !Array.isArray(n.fills)) return;
      const f = n.fills.find((p) => p.type === "SOLID" && p.visible !== false);
      if (f && saturation(f.color) > 0.45 && n.width >= 120) primaries.push(n);
    });
    if (primaries.length > 1) add("warn", "hierarchy", "competing-primary", s, `${primaries.length} primary buttons: ${primaries.map((p) => p.name.replace(/^Button\//, "")).join(", ")}`, "Keep one primary action; make the rest secondary.");
  }
  if (spacingOff.length) {
    add("info", "systems", "spacing-grid", spacingOff[0], `${spacingOff.length} auto-layout frames use gaps or padding off the ${grid} px grid (first: ${spacingOff[0].name})`, `Snap spacing to multiples of ${grid}.`);
    issues["spacing-grid"] = spacingOff.length * 0.5;
  }
  tick("type-scale"); tick("font-families"); tick("colour-count");
  if (fontSizes.size > 9) add("info", "visual", "type-scale", root, `${fontSizes.size} font sizes in use: ${[...fontSizes.keys()].sort((a, b) => a - b).join(", ")}`, "Collapse to a type scale of about 6 to 8 steps.");
  if (families.size > 2) add("warn", "visual", "font-families", root, `${families.size} font families: ${[...families].join(", ")}`, "Use one or two families.");
  if (colors.size > 28) add("info", "systems", "colour-count", root, `${colors.size} distinct fill colours`, "Map colours to tokens or styles.");

  // Per rule: pass rate weighted by severity (fail 1, warn 0.6, info 0.3). Per category: mean of its rules.
  const W = { fail: 1, warn: 0.6, info: 0.3 };
  for (const f of findings) if (f.rule !== "spacing-grid") issues[f.rule] = (issues[f.rule] || 0) + W[f.severity];
  const ruleScore = (r) => (checked[r] ? Math.max(0, Math.round(100 * (1 - Math.min(1, (issues[r] || 0) / checked[r])))) : null);
  const RULES = { accessibility: ["contrast", "touch-target", "min-text-size"], visual: ["text-overflow", "type-scale", "font-families"], hierarchy: ["competing-primary"], content: ["placeholder-copy", "all-caps"], systems: ["spacing-grid", "colour-count"] };
  const byCategory = {};
  for (const [k, v] of Object.entries(CATEGORIES)) {
    const rules = Object.fromEntries(RULES[k].map((r) => [r, ruleScore(r)]).filter(([, s]) => s !== null));
    const vals = Object.values(rules);
    byCategory[k] = { title: v.title, persona: PERSONAS.find((p) => p.id === v.persona)?.name, score: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 100, rules, findings: findings.filter((f) => f.category === k).length };
  }
  const overall = Math.round(Object.values(byCategory).reduce((s, c) => s + c.score, 0) / Object.keys(byCategory).length);

  // Contrast groups: failing text colours, most used first, each with the nearest darker colour that passes 4.5:1
  // on the hardest background it sits on.
  const contrastGroups = [...pairs.values()].sort((a, b) => b.count - a.count).slice(0, 8).map((g) => {
    const bg = g.bgs.reduce((m, c) => (lum(c) < lum(m) ? c : m), g.bgs[0]);
    let suggest = null;
    if (g.color !== "gradient") {
      let c = hexToRgb(g.color);
      const lighten = lum(c) > lum(bg);
      for (let i = 0; i < 80 && contrast(c, bg) < 4.5; i++) c = lighten ? { r: c.r + (1 - c.r) * 0.08, g: c.g + (1 - c.g) * 0.08, b: c.b + (1 - c.b) * 0.08 } : { r: c.r * 0.97, g: c.g * 0.97, b: c.b * 0.97 };
      const h = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
      suggest = "#" + h(c.r) + h(c.g) + h(c.b);
    }
    return { color: g.color, texts: g.count, worstRatio: Math.round(g.worst * 100) / 100, suggest };
  });

  const order = { fail: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return {
    screens: screens.map((s) => ({ id: s.id, name: s.name })),
    score: { overall, byCategory },
    checked,
    counts: { fail: findings.filter((f) => f.severity === "fail").length, warn: findings.filter((f) => f.severity === "warn").length, info: findings.filter((f) => f.severity === "info").length },
    contrastGroups,
    // Fill colours outside the default tokens (lib/color-tokens.js). Reported, not scored.
    offTokenColors: [...colors].filter((c) => !isTokenColor(c)).sort(),
    typeScale: [...fontSizes.keys()].sort((a, b) => a - b),
    findings: findings.slice(0, 200),
    truncatedFindings: Math.max(0, findings.length - 200),
  };
}
