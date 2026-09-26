// Capnix posts v2: clone library slides into frame 826:2, replace copy, unique renders per slide,
// on-brand infographics where no render fits, contrast fixes, save prompt, row labels.
// Idempotent: removes earlier generated nodes first.

const hex = (h) => { h = h.replace("#", ""); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
const RED = hex("#FA4028"), RED_TEXT = hex("#D20600"), HEAD = hex("#071437"), TEXT1 = hex("#252F4A"), TEXT2 = hex("#4B5675"), WHITE = hex("#FFFFFF"), SOFT = hex("#DFE3EC");
const solid = (c, o = 1) => [{ type: "SOLID", color: c, opacity: o }];

const target = await figma.getNodeByIdAsync("826:2");
for (const c of [...target.children]) if (c.getPluginData("capnixGen") === "1") c.remove();

for (const f of [["Inter", "Regular"], ["Inter", "Medium"], ["Inter", "Semi Bold"], ["Inter", "Bold"], ["Addington CF", "Demi Bold"], ["Addington CF", "Bold"], ["Addington CF", "Regular"]])
  await figma.loadFontAsync({ family: f[0], style: f[1] });

const node = async (id) => { const n = await figma.getNodeByIdAsync(id); if (!n) throw new Error("Missing node " + id); return n; };
function pathOf(root, n) { const p = []; while (n && n !== root) { p.unshift(n.parent.children.indexOf(n)); n = n.parent; } return p; }
function follow(root, path) { let n = root; for (const i of path) n = n.children[i]; return n; }
async function part(src, c, childId) { return follow(c, pathOf(src, await node(childId))); }

async function loadAll(t) { const fonts = t.characters.length ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName]; for (const f of fonts) await figma.loadFontAsync(f); }
async function setText(t, chars, opts = {}) {
  await loadAll(t);
  const first = t.getRangeFontName(0, 1);
  t.characters = chars;
  t.setRangeFontName(0, chars.length, first);
  if (opts.fill) t.setRangeFills(0, chars.length, solid(opts.fill));
  for (const [phrase, color, font] of opts.ranges || []) {
    const i = chars.indexOf(phrase); if (i < 0) continue;
    if (font) t.setRangeFontName(i, i + phrase.length, font);
    t.setRangeFills(i, i + phrase.length, solid(color));
  }
  return t;
}
function fit(t, max = 1040) { let size = t.fontSize; while (t.width > max && size > 40) { size -= 2; t.fontSize = size; } }
// Addington CF numbers must use lining proportional figures (LNUM + PNUM). The plugin API cannot set
// OpenType features, so digits are typed into a copy of a library layer that already has them.
const LINING_SEED = await figma.getNodeByIdAsync("823:881"); // "loan 3 months before": the "3" carries LNUM+PNUM
for (const f of LINING_SEED.getRangeAllFontNames(0, LINING_SEED.characters.length)) await figma.loadFontAsync(f);
function liningText(parent, chars) {
  const t = LINING_SEED.clone(); parent.appendChild(t);
  const i = t.characters.indexOf("3");
  t.deleteCharacters(i + 1, t.characters.length); t.deleteCharacters(0, i);
  t.insertCharacters(1, chars, "BEFORE"); t.deleteCharacters(0, 1);
  t.textAutoResize = "WIDTH_AND_HEIGHT";
  return t;
}
function mkText(parent, chars, family, style, size, color, o = {}) {
  const lining = family.startsWith("Addington") && /\d/.test(chars);
  const t = lining ? liningText(parent, chars) : figma.createText(); if (!lining) parent.appendChild(t);
  const font = { family, style };
  if (lining) { t.setRangeFontName(0, chars.length, font); t.setRangeFontSize(0, chars.length, size); t.setRangeFills(0, chars.length, solid(color, o.opacity ?? 1)); t.setRangeLetterSpacing(0, chars.length, { value: 0, unit: "PIXELS" }); }
  else { t.fontName = font; t.characters = chars; t.fontSize = size; t.fills = solid(color, o.opacity ?? 1); }
  if (o.w) { t.resize(o.w, t.height); t.textAutoResize = "HEIGHT"; }
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.lh) t.lineHeight = { value: o.lh, unit: "PERCENT" };
  if (o.x !== undefined) { t.x = o.x; t.y = o.y; }
  t.name = o.name || chars.slice(0, 30);
  return t;
}
function al(parent, name, dir, o = {}) {
  const f = figma.createFrame(); parent.appendChild(f);
  f.name = name; f.layoutMode = dir; f.fills = o.fills || []; f.itemSpacing = o.gap ?? 0;
  const [pt, pr, pb, pl] = o.pad === undefined ? [0, 0, 0, 0] : typeof o.pad === "number" ? [o.pad, o.pad, o.pad, o.pad] : o.pad;
  f.paddingTop = pt; f.paddingRight = pr; f.paddingBottom = pb; f.paddingLeft = pl;
  f.primaryAxisAlignItems = o.main || "MIN"; f.counterAxisAlignItems = o.cross || "MIN";
  f.cornerRadius = o.r || 0; if (o.r) f.cornerSmoothing = 0.6;
  if (o.w) f.resize(o.w, o.h || 100);
  f.layoutSizingHorizontal = o.w ? "FIXED" : "HUG"; f.layoutSizingVertical = o.h ? "FIXED" : "HUG";
  if (o.stroke) { f.strokes = solid(o.stroke, o.strokeOpacity ?? 1); f.strokeWeight = o.strokeWeight || 2; f.strokeAlign = "INSIDE"; }
  if (o.x !== undefined) { f.x = o.x; f.y = o.y; }
  return f;
}
function hideHaze(slide) { for (const e of slide.findAll((n) => n.type === "ELLIPSE" && n.name !== "Glow")) e.visible = false; }
function fillW(n) { n.layoutSizingHorizontal = "FILL"; return n; }

function cleanup(slide, dark = false) {
  for (const t of slide.findAll((n) => n.type === "TEXT" && n.characters.includes("DPDP"))) {
    const pill = t.parent && t.parent !== slide && t.parent.type === "FRAME" ? t.parent : t; pill.remove();
  }
  // Contrast: small footer link on light slides and the "/10" total. Footer line box pinned to the library's 53 px.
  for (const t of slide.findAll((n) => n.type === "TEXT")) {
    if (t.characters === "capnix.ai") t.lineHeight = { value: 53, unit: "PIXELS" };
    if (!dark && t.characters === "capnix.ai" && t.fills[0] && t.fills[0].color && Math.abs(t.fills[0].color.r - RED.r) < 0.02) t.fills = solid(RED_TEXT);
    if (/^\/\d+$/.test(t.characters)) t.fills = solid(TEXT2);
  }
}
async function cloneSlide(srcId, name, x, y) {
  const src = await node(srcId); const c = src.clone(); target.appendChild(c);
  c.x = x; c.y = y; c.name = name; c.setPluginData("capnixGen", "1");
  return { src, c };
}
async function swapObject(src, c, templateObjId, donorObjId) {
  if (templateObjId) (await part(src, c, templateObjId)).remove();
  if (!donorObjId) return;
  const donor = await node(donorObjId); const o = donor.clone(); c.appendChild(o);
  o.x = donor.x; o.y = donor.y; o.name = "Object";
}

// Tip templates: node ids of headline lines, body, page number, total, and a separable render (if any).
const TIP = {
  "790:983":  { lines: ["790:1003", "790:1005"], body: "790:1007", page: "790:990", total: "790:991", obj: "790:998" },   // GST (Object)
  "790:1043": { lines: ["790:1061", "790:1063"], body: "790:1065", page: "790:1050", total: "790:1051", obj: "793:1267" }, // CIBIL 782 (Object)
  "790:1015": { lines: ["790:1019", "790:1020", "790:1021"], body: "790:1023", page: "790:1035", total: "790:1036" },    // FY books (baked)
  "790:1102": { lines: ["790:1124", "790:1126"], body: "790:1128", page: "790:1113", total: "790:1114" },                // bank statements (baked)
  "793:1710": { lines: ["793:1732", "793:1734"], body: "793:1736", page: "793:1722", total: "793:1723" },                // loan plan target (baked)
  "793:1738": { lines: ["793:1760", "793:1762"], body: "793:1764", page: "793:1750", total: "793:1751" },                // revenue chart (baked)
  "790:925":  { lines: ["790:956", "790:958"], body: "790:960", page: "790:940", total: "790:941" },                     // expense accounts (baked)
  "793:1693": { lines: ["793:1703", "793:1705", "793:1706"], body: "793:1708", page: "793:1822", total: "793:1823" },   // binders + start early (baked)
};

async function tip(n, s, x, y) {
  const tplId = s.template || "790:983";
  const T = TIP[tplId];
  const { src, c } = await cloneSlide(tplId, String(n).padStart(2, "0"), x, y);
  const lines = []; for (const id of T.lines) lines.push(await part(src, c, id));
  const body = await part(src, c, T.body), page = await part(src, c, T.page), total = await part(src, c, T.total);
  const obj = T.obj ? await part(src, c, T.obj) : null;
  await setText(page, String(n).padStart(2, "0"));
  await setText(total, "/10");
  const l1 = await setText(lines[0], s.h1, { fill: HEAD }); l1.fontSize = 96; fit(l1);
  const l2 = await setText(lines[1], s.h2, { fill: RED }); l2.fontSize = 96; fit(l2);
  for (const extra of lines.slice(2)) extra.remove();
  await setText(body, s.body);
  if (s.donor && obj) { obj.remove(); await swapObject(src, c, null, s.donor); }
  if (s.infographic && obj) { obj.remove(); await INFO[s.infographic](c); }
  cleanup(c); return c;
}
async function coverFromA(copy, x, y) {
  const { src, c } = await cloneSlide("790:963", "01", x, y);
  await setText(await part(src, c, "790:977"), copy.lead);
  fit(await setText(await part(src, c, "790:979"), copy.keyword));
  fit(await setText(await part(src, c, "790:980"), copy.line3));
  await setText(await part(src, c, "790:981"), copy.qualifier);
  cleanup(c, true); return c;
}
async function ctaFrom(tplId, map, copy, x, y) {
  const { src, c } = await cloneSlide(tplId, "10", x, y);
  const st = await setText(await part(src, c, map.statement), copy.statement, { ranges: [["MSME owner", RED, { family: "Inter", style: "Semi Bold" }]] });
  await setText(await part(src, c, map.question), copy.question, { fill: HEAD, ranges: [[copy.red, RED]] });
  if (map.obj && copy.donor) { (await part(src, c, map.obj)).remove(); await swapObject(src, c, null, copy.donor); }
  // Save prompt under the question box, in the same content column.
  const column = st.parent;
  const save0 = mkText(column, "Save this for your next loan application.", "Inter", "Semi Bold", 36, TEXT2, { name: "Save prompt" });
  const save = mkText(column, "Capnix is not a lender. Loans are offered by partner banks and NBFCs, subject to their approval.", "Inter", "Medium", 28, TEXT2, { name: "Disclaimer", w: 1040 });
  column.itemSpacing = column.itemSpacing; save.layoutSizingHorizontal = "FILL";
  if (column.layoutMode === "NONE") { save.x = 80; save.y = 925; }
  if (column.layoutMode !== "NONE" && column.layoutSizingVertical === "FIXED") column.layoutSizingVertical = "HUG";
  const obj = c.children.find((n) => n.name === "Object");
  if (obj) {
    const saveBottom = save.absoluteBoundingBox.y - c.absoluteBoundingBox.y + save.height;
    const top = saveBottom + 40, bottom = 1360;
    if (obj.y < top || obj.y + obj.height > bottom) {
      const scale = Math.min(1, (bottom - top) / obj.height, 900 / obj.width);
      obj.resize(Math.round(obj.width * scale), Math.round(obj.height * scale));
      obj.x = Math.round((1200 - obj.width) / 2); obj.y = Math.round(top + (bottom - top - obj.height) / 2);
    }
  }
  cleanup(c); return c;
}

// ---------- Infographics (built in the library's language) ----------
const INFO = {
  // D 09: total cost comparison, light slide, sits where the render was (y ≈ 900-1330).
  async costCompare(slide) {
    const wrap = al(slide, "Infographic · Total cost", "VERTICAL", { gap: 18, w: 1040, x: 80, y: 800 });
    wrap.layoutSizingVertical = "HUG";
    mkText(wrap, "₹10 lakh loan · 3 years", "Inter", "Semi Bold", 32, TEXT2);
    const row = al(wrap, "Cards", "HORIZONTAL", { gap: 24 }); fillW(row);
    const card = async (tag, rate, fee, totalLabel, total, best) => {
      const k = al(row, "Loan " + tag, "VERTICAL", { gap: 18, pad: [32, 36, 32, 36], r: 28, fills: best ? solid(hex("#FFF4F1")) : solid(WHITE), stroke: best ? RED : hex("#E4E7EC"), strokeWeight: best ? 3 : 2 });
      fillW(k);
      const top = al(k, "Top", "HORIZONTAL", { main: "SPACE_BETWEEN", cross: "CENTER" }); fillW(top);
      mkText(top, "Loan " + tag, "Addington CF", "Demi Bold", 48, HEAD);
      if (best) { const p = al(top, "Cheaper pill", "HORIZONTAL", { pad: [8, 18, 8, 18], r: 30, fills: solid(RED) }); mkText(p, "Cheaper", "Inter", "Semi Bold", 24, WHITE); }
      mkText(k, rate + " interest", "Inter", "Medium", 34, TEXT1);
      mkText(k, fee + " processing fee", "Inter", "Medium", 34, TEXT1);
      const rule = figma.createRectangle(); k.appendChild(rule); rule.resize(85, 6); rule.fills = solid(RED); rule.name = "Rule";
      mkText(k, totalLabel, "Inter", "Medium", 28, TEXT2);
      mkText(k, total, "Addington CF", "Bold", 64, best ? RED_TEXT : HEAD);
    };
    await card("A", "11.5%", "0.5%", "Total cost", "₹1,92,136", true);
    await card("B", "11%", "2%", "Total cost", "₹1,98,594", false);
    mkText(wrap, "Illustrative example. Total cost = interest + processing fee.", "Inter", "Medium", 28, TEXT2);
  },
  // Single 2: EMI vs total interest by tenure, dark post.
  async tenureCompare(slide) {
    const wrap = al(slide, "Infographic · Tenure", "VERTICAL", { gap: 22, w: 900, x: 150, y: 830 });
    wrap.layoutSizingVertical = "HUG"; wrap.counterAxisAlignItems = "CENTER";
    mkText(wrap, "₹10 lakh loan at 12%", "Inter", "Semi Bold", 32, SOFT);
    const row = al(wrap, "Cards", "HORIZONTAL", { gap: 24 }); fillW(row);
    const card = (years, emi, interest, pct, hot) => {
      const k = al(row, years, "VERTICAL", { gap: 14, pad: [30, 32, 30, 32], r: 28, fills: solid(WHITE, 0.07), stroke: hot ? RED : WHITE, strokeOpacity: hot ? 1 : 0.18, strokeWeight: 2 });
      fillW(k);
      mkText(k, years, "Addington CF", "Demi Bold", 48, WHITE);
      mkText(k, "EMI " + emi, "Inter", "Medium", 34, SOFT);
      mkText(k, "Total interest", "Inter", "Medium", 26, SOFT, { opacity: 0.7 });
      mkText(k, interest, "Addington CF", "Bold", 58, hot ? RED : WHITE);
      const track = al(k, "Bar track", "HORIZONTAL", { r: 6, fills: solid(WHITE, 0.14), w: 100, h: 12 }); fillW(track);
      const bar = figma.createRectangle(); track.appendChild(bar); bar.resize(Math.max(20, 3.36 * pct), 12); bar.cornerRadius = 6; bar.fills = solid(hot ? RED : WHITE); bar.name = "Bar";
    };
    card("3 years", "₹33,214", "₹1,95,715", 58, false);
    card("5 years", "₹22,244", "₹3,34,667", 100, true);
    mkText(wrap, "Lower EMI, but ₹1.39 lakh more interest.", "Inter", "Semi Bold", 34, WHITE);
  },
  // D cover: working capital vs term loan split cards on the dark cover.
  async wcVsTl(slide) {
    const wrap = al(slide, "Infographic · WC vs TL", "HORIZONTAL", { gap: 28, w: 1040, x: 80, y: 800 });
    wrap.layoutSizingVertical = "HUG";
    const card = (title, line, points, hot) => {
      const k = al(wrap, title, "VERTICAL", { gap: 20, pad: [40, 40, 44, 40], r: 32, fills: hot ? solid(RED, 0.16) : solid(WHITE, 0.07), stroke: hot ? RED : WHITE, strokeOpacity: hot ? 0.9 : 0.2, strokeWeight: 2 });
      fillW(k);
      const pill = al(k, "Pill", "HORIZONTAL", { pad: [10, 22, 10, 22], r: 40, fills: hot ? solid(RED) : solid(WHITE, 0.12) });
      mkText(pill, title, "Inter", "Semi Bold", 30, WHITE);
      mkText(k, line, "Addington CF", "Demi Bold", 52, WHITE, { w: 420, lh: 110 });
      const rule = figma.createRectangle(); k.appendChild(rule); rule.resize(85, 6); rule.fills = solid(RED); rule.name = "Rule";
      for (const p of points) mkText(k, p, "Inter", "Medium", 32, SOFT, { w: 420 });
    };
    card("Working capital", "Runs the business", ["Stock, salaries, suppliers", "3 to 12 months", "Credit line or overdraft"], false);
    card("Term loan", "Builds the business", ["Machinery, premises, vehicles", "1 to 7 years", "Fixed monthly EMIs"], true);
    for (const k of wrap.children) k.layoutSizingVertical = "FILL";
  },
};

async function coverD(copy, x, y) {
  const { src, c } = await cloneSlide("823:862", "01", x, y);
  (await part(src, c, "823:865")).visible = false; // hide the "3 months ahead" calendar render
  await setText(await part(src, c, "823:880"), copy.lead);
  fit(await setText(await part(src, c, "823:881"), copy.keyword));
  await setText(await part(src, c, "823:882"), copy.qualifier);
  // Rebuild the dark red glow the hidden image provided.
  const base = figma.createRectangle(); c.insertChild(0, base); base.resize(1200, 1500); base.name = "Background · dark";
  base.fills = [{ type: "GRADIENT_LINEAR", gradientTransform: [[0.5, 0.5, 0], [-0.5, 0.5, 0.5]], gradientStops: [{ position: 0, color: { ...hex("#000000"), a: 1 } }, { position: 0.55, color: { ...hex("#0B0B0F"), a: 1 } }, { position: 1, color: { ...hex("#5A0A02"), a: 1 } }] }];
  const glow = figma.createEllipse(); c.insertChild(1, glow); glow.resize(1100, 900); glow.x = 250; glow.y = 900; glow.fills = solid(hex("#FA4028"), 0.45); glow.effects = [{ type: "LAYER_BLUR", radius: 260, visible: true }]; glow.name = "Glow";
  hideHaze(c);
  await INFO.wcVsTl(c);
  cleanup(c, true); return c;
}
async function single(copy, x, y) {
  const { src, c } = await cloneSlide("790:1186", copy.name, x, y);
  await setText(await part(src, c, "790:1201"), copy.lead);
  const k = await setText(await part(src, c, "790:1202"), copy.keyword, { ranges: [[copy.red, RED], [copy.white, WHITE]] });
  fit(k, 1000);
  if (copy.size) k.fontSize = Math.min(k.fontSize, copy.size);
  k.x = Math.round((1200 - k.width) / 2);
  await setText(await part(src, c, "790:1203"), copy.qualifier);
  if (copy.infographic) {
    (await part(src, c, "790:1189")).visible = false; // hide coins render
    const base = figma.createRectangle(); c.insertChild(0, base); base.resize(1200, 1500); base.name = "Background · dark";
    base.fills = [{ type: "GRADIENT_LINEAR", gradientTransform: [[0, 1, 0], [-1, 0, 1]], gradientStops: [{ position: 0, color: { ...hex("#000000"), a: 1 } }, { position: 0.6, color: { ...hex("#120404"), a: 1 } }, { position: 1, color: { ...hex("#4A0A03"), a: 1 } }] }];
    const glow = figma.createEllipse(); c.insertChild(1, glow); glow.resize(1000, 800); glow.x = 100; glow.y = 950; glow.fills = solid(hex("#FA4028"), 0.4); glow.effects = [{ type: "LAYER_BLUR", radius: 240, visible: true }]; glow.name = "Glow";
    hideHaze(c);
    await INFO[copy.infographic](c);
  }
  cleanup(c, true); return c;
}

const W = 1200, GAP = 100, ROW = 1500 + 400, X0 = 200, Y0 = 260;
const label = (text, y) => { const t = mkText(target, text, "Inter", "Semi Bold", 72, WHITE, { x: X0, y: y - 150, name: "Label · " + text }); t.setPluginData("capnixGen", "1"); };
const report = [];
async function carousel(key, row, coverFn, ctaTpl) {
  const data = DATA[key]; const y = Y0 + row * ROW; label(data.label, y);
  const made = [await coverFn(data.cover, X0, y)];
  for (let i = 0; i < data.tips.length; i++) made.push(await tip(i + 2, data.tips[i], X0 + (i + 1) * (W + GAP), y));
  made.push(await ctaFrom(ctaTpl.id, ctaTpl.map, data.cta, X0 + 9 * (W + GAP), y));
  report.push({ [key]: made.map((m) => m.id) });
}
await carousel("C", 0, coverFromA, { id: "823:1050", map: { statement: "823:1065", question: "823:1068", obj: "823:1069" } });
await carousel("D", 1, coverD, { id: "823:1050", map: { statement: "823:1065", question: "823:1068", obj: "823:1069" } });
const sy = Y0 + 2 * ROW; label("Single posts", sy);
report.push({ S: [(await single(DATA.S1, X0, sy)).id, (await single(DATA.S2, X0 + W + GAP, sy)).id] });

const notLining = [];
for (const t of target.findAll((n) => n.type === "TEXT" && /\d/.test(n.characters))) {
  for (const seg of t.getStyledTextSegments(["fontName"])) {
    if (!seg.fontName.family.startsWith("Addington")) continue;
    for (let k = seg.start; k < seg.end; k++) if (/\d/.test(t.characters[k])) { const f = t.getRangeOpenTypeFeatures(k, k + 1); if (!f.LNUM) { notLining.push({ id: t.id, chars: t.characters.slice(0, 30) }); k = seg.end; } }
  }
}
const wide = target.findAll((n) => n.type === "TEXT" && n.fontSize >= 90 && n.width > 1045).map((n) => ({ id: n.id, w: Math.round(n.width), chars: n.characters }));
return { report, wide, notLining };
