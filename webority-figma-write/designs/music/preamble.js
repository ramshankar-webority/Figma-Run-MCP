// Shared helpers for every screen call. Runs as the start of an async function body in the plugin.
for (const s of ["Regular", "Medium", "Semi Bold", "Bold"]) await figma.loadFontAsync({ family: "Inter", style: s });

const C = {
  bg: "#0B0B12", surface: "#15151F", surface2: "#1E1E2B", line: "#2A2A3A",
  text: "#FFFFFF", muted: "#9A9AB0", dim: "#6B6B80",
  pink: "#FF4D8D", violet: "#7B61FF", cyan: "#22D3EE",
};
const PAL = [
  ["#FF4D8D", "#7B61FF"], ["#22D3EE", "#3B82F6"], ["#F59E0B", "#EF4444"],
  ["#10B981", "#0EA5E9"], ["#A855F7", "#EC4899"], ["#F97316", "#FACC15"], ["#6366F1", "#22D3EE"],
];

const rgb = (h) => { h = h.replace("#", ""); const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255; return { r: n(0), g: n(2), b: n(4) }; };
const solid = (h, o = 1) => [{ type: "SOLID", color: rgb(h), opacity: o }];
const TF = { h: [[1, 0, 0], [0, 1, 0]], v: [[0, 1, 0], [-1, 0, 1]], d: [[0.5, 0.5, 0], [-0.5, 0.5, 0.5]] };
const grad = (stops, dir = "d") => [{
  type: "GRADIENT_LINEAR", gradientTransform: TF[dir],
  gradientStops: stops.map((s, i) => {
    const [hex, a = 1, pos] = Array.isArray(s) ? s : [s];
    return { position: pos ?? i / (stops.length - 1), color: { ...rgb(hex), a } };
  }),
}];

function frame(parent, name, x, y, w, h, fills = [], r = 0) {
  const f = figma.createFrame(); parent.appendChild(f);
  f.name = name; f.x = x; f.y = y; f.resize(w, h); f.fills = fills; f.cornerRadius = r; f.clipsContent = true;
  return f;
}
function rect(parent, name, x, y, w, h, fills, r = 0) {
  const n = figma.createRectangle(); parent.appendChild(n);
  n.name = name; n.x = x; n.y = y; n.resize(w, h); n.fills = fills; n.cornerRadius = r;
  return n;
}
function ellipse(parent, name, x, y, w, h, fills) {
  const n = figma.createEllipse(); parent.appendChild(n);
  n.name = name; n.x = x; n.y = y; n.resize(w, h); n.fills = fills;
  return n;
}
function text(parent, str, x, y, o = {}) {
  const t = figma.createText(); parent.appendChild(t);
  t.fontName = { family: "Inter", style: o.style || "Regular" };
  t.characters = str;
  t.fontSize = o.size || 14;
  t.fills = solid(o.color || C.text, o.opacity ?? 1);
  if (o.ls !== undefined) t.letterSpacing = { value: o.ls, unit: "PIXELS" };
  if (o.lh) t.lineHeight = { value: o.lh, unit: "PIXELS" };
  if (o.w) { t.resize(o.w, t.height); t.textAutoResize = "HEIGHT"; }
  if (o.align) t.textAlignHorizontal = o.align;
  t.x = x; t.y = y; t.name = o.name || str.slice(0, 40);
  return t;
}
const glow = (hex, radius) => ({ type: "LAYER_BLUR", radius, visible: true });
const shadow = (hex, a, y, radius) => ({ type: "DROP_SHADOW", color: { ...rgb(hex), a }, offset: { x: 0, y }, radius, spread: 0, visible: true, blendMode: "NORMAL" });

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  library: '<path d="M4 4v16M9 4v16M14 4.5l5.5 15.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  share: '<path d="M4 12v8h16v-8M12 3v13M7 8l5-5 5 5"/>',
  queue: '<path d="M3 6h14M3 12h14M3 18h9M19 14v7M15.5 17.5h7"/>',
  devices: '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="6.5" r="1"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const PF = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>',
  back: '<path d="M18.5 19.1 9.6 12.9a1.1 1.1 0 0 1 0-1.8l8.9-6.2A1 1 0 0 1 20 5.7v12.6a1 1 0 0 1-1.5.8z"/><rect x="4" y="4.5" width="2.8" height="15" rx="1.2"/>',
  next: '<path d="M5.5 4.9l8.9 6.2a1.1 1.1 0 0 1 0 1.8l-8.9 6.2A1 1 0 0 1 4 18.3V5.7a1 1 0 0 1 1.5-.8z"/><rect x="17.2" y="4.5" width="2.8" height="15" rx="1.2"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-10.9A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 3c0 6-8 10.9-8 10.9z"/>',
};
function icon(parent, key, x, y, size = 24, color = C.text, name) {
  const filled = PF[key] && !P[key] ? true : false;
  const body = filled ? PF[key] : P[key];
  const svg = filled
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">${body}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const n = figma.createNodeFromSvg(svg); parent.appendChild(n);
  n.name = name || "icon/" + key; n.x = x; n.y = y;
  return n;
}
function iconFilled(parent, key, x, y, size, color, name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">${PF[key]}</svg>`;
  const n = figma.createNodeFromSvg(svg); parent.appendChild(n);
  n.name = name || "icon/" + key + "-filled"; n.x = x; n.y = y;
  return n;
}

// Abstract album art: gradient square + blurred orbs + a ring.
function art(parent, name, x, y, size, p = 0, r = 16) {
  const [a, b] = PAL[p % PAL.length];
  const f = frame(parent, name, x, y, size, size, grad([a, b], "d"), r);
  const o1 = ellipse(f, "orb", -size * 0.2, size * 0.45, size * 0.9, size * 0.9, solid(b, 0.9)); o1.effects = [glow(b, size * 0.18)];
  const o2 = ellipse(f, "orb", size * 0.45, -size * 0.25, size * 0.7, size * 0.7, solid("#FFFFFF", 0.35)); o2.effects = [glow("#FFFFFF", size * 0.15)];
  const ring = ellipse(f, "ring", size * 0.28, size * 0.28, size * 0.44, size * 0.44, []);
  ring.strokes = solid("#FFFFFF", 0.55); ring.strokeWeight = Math.max(1, size / 90);
  const dot = ellipse(f, "dot", size * 0.46, size * 0.46, size * 0.08, size * 0.08, solid("#FFFFFF", 0.9));
  return f;
}

function statusBar(parent, color = C.text) {
  const g = frame(parent, "Status bar", 0, 0, 390, 48, []);
  text(g, "9:41", 34, 15, { size: 16, style: "Semi Bold", color });
  [4, 7, 10, 13].forEach((h, i) => rect(g, "signal", 290 + i * 5.5, 30 - h, 3.5, h, solid(color), 1));
  const bat = rect(g, "battery", 322, 16, 25, 13, [], 4); bat.strokes = solid(color, 0.4); bat.strokeWeight = 1;
  rect(g, "battery level", 324, 18, 19, 9, solid(color), 2);
  rect(g, "battery cap", 348.5, 20.5, 1.6, 4, solid(color, 0.4), 1);
  return g;
}

function bottomNav(parent, active) {
  const nav = frame(parent, "Bottom nav", 0, 760, 390, 84, grad([[C.bg, 0, 0], [C.bg, 0.96, 0.35], [C.bg, 1, 1]], "v"));
  const items = [["home", "Home"], ["search", "Search"], ["library", "Library"], ["user", "Profile"]];
  items.forEach(([k, label], i) => {
    const cx = 49 + i * 97;
    const on = k === active;
    icon(nav, k, cx - 12, 22, 24, on ? C.text : C.dim);
    text(nav, label, cx - 30, 52, { size: 11, style: on ? "Semi Bold" : "Medium", color: on ? C.text : C.dim, w: 60, align: "CENTER" });
    if (on) rect(nav, "active dot", cx - 10, 12, 20, 3, grad([C.pink, C.violet], "h"), 2);
  });
  rect(nav, "home indicator", 128, 74, 134, 5, solid("#FFFFFF", 0.9), 3);
  return nav;
}

function screen(section, name, index) {
  const s = frame(section, name, 80 + index * 470, 140, 390, 844, solid(C.bg), 44);
  return s;
}
