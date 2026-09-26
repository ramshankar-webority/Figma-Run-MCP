// Shared helpers for the OfficeLoop V2 flow sections (Passes, Onboarding + Profile).
// Appended to designs/shuttle-passes/preamble.js and designs/shuttle-onboarding/preamble.js.

function flowSection(name, title, sub, labels, y) {
  const section = figma.createSection(); figma.currentPage.appendChild(section);
  section.name = name; section.x = V1 ? V1.x : 0; section.y = y;
  section.resizeWithoutConstraints(80 + labels.length * 470, 200 + 844 + 120);
  section.fills = solid("#EEF1F6");
  const tt = row(section, "Title", { gap: 12, cross: "CENTER" }); tt.x = 80; tt.y = 44;
  t(tt, title, { size: 44, weight: "bold", ls: -1.2 });
  const v = row(tt, "Version", { pad: [6, 14], r: 16, cross: "CENTER", fills: solid(C.p) }); t(v, "V2", { size: 20, weight: "bold", color: C.white });
  text(section, sub, 80, 106, { size: 16, color: C.t2, weight: "medium" });
  labels.forEach((l, i) => {
    const g = row(section, "Label/" + l, { gap: 10, cross: "CENTER" }); g.x = 80 + i * 470; g.y = 150;
    const n = row(g, "num", { w: 28, h: 28, r: 14, main: "CENTER", cross: "CENTER", fills: solid(C.p) });
    t(n, String(i + 1), { size: 13, weight: "bold", color: C.white });
    t(g, l, { size: 16, weight: "semibold", color: C.heading });
  });
  return section;
}
// Gradient pass card (the "physical" pass look).
function passArt(parent, name, o = {}) {
  const w = o.w || 350, h = o.h || 176;
  const f = frame(parent, name, 0, 0, w, h, grad([["#193EE4", 1, 0], ["#2F50E4", 1, 0.55], ["#1B84FF", 1, 1]], "d"), 28);
  if (parent.layoutMode && parent.layoutMode !== "NONE") fill(f);
  const c1 = ellipse(f, "Deco", w - 150, -60, 220, 220, solid("#FFFFFF", 0.08));
  const c2 = ellipse(f, "Deco 2", w - 90, h - 90, 160, 160, solid("#FFFFFF", 0.06));
  return f;
}
// Circular progress ring using ellipse arcs.
function ring(parent, size, frac, color, track, thick = 10, name = "Ring") {
  const g = frame(parent, name, 0, 0, size, size, [], 0); g.clipsContent = false;
  const bg = ellipse(g, "Track", 0, 0, size, size, solid(track)); bg.arcData = { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 1 - (thick * 2) / size };
  const fg = ellipse(g, "Progress", 0, 0, size, size, solid(color)); fg.arcData = { startingAngle: -Math.PI / 2, endingAngle: -Math.PI / 2 + Math.PI * 2 * frac, innerRadius: 1 - (thick * 2) / size };
  return g;
}
function toggle(parent, on = true) {
  const tg = row(parent, on ? "Switch (on)" : "Switch (off)", { w: 52, h: 32, r: 16, pad: 3, main: on ? "MAX" : "MIN", cross: "CENTER", fills: solid(on ? C.ok : C.t5) });
  ellipse(tg, "knob", 0, 0, 26, 26, solid(C.white));
  return tg;
}
function radio(parent, on) {
  const rd = row(parent, "Radio", { w: 22, h: 22, r: 11, main: "CENTER", cross: "CENTER", fills: on ? solid(C.p) : solid(C.white), stroke: on ? undefined : C.t5 });
  if (on) ellipse(rd, "in", 0, 0, 8, 8, solid(C.white));
  return rd;
}
// Settings-style row: icon tile, title + sub, right text or chevron.
function listRow(parent, key, fg, bg, title, sub, right, o = {}) {
  const r = row(parent, "Row/" + title, { pad: [11, 0], gap: 12, cross: "CENTER" }); fill(r);
  iconTile(r, key, fg, bg, 38, 12);
  const tx = col(r, "t", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, title, { size: 15, weight: "semibold", color: o.danger ? C.errA : C.heading });
  if (sub) t(tx, sub, { size: 12, weight: "medium", color: C.t3 });
  if (right) t(r, right, { size: 13, weight: "semibold", color: o.rightColor || C.t2 });
  if (!o.noChevron) icon(r, "arrow-right-linear", 0, 0, 16, C.t4);
  return r;
}
function kpi(parent, label, value, delta, up = true, key) {
  const k = col(parent, "KPI/" + label, { pad: 14, gap: 6, r: 20, fills: solid(C.white), stroke: C.border }); sizing(k, "FILL", "HUG");
  const hr = row(k, "h", { gap: 6, cross: "CENTER" }); fill(hr);
  if (key) icon(hr, key, 0, 0, 16, C.p);
  t(hr, label, { size: 12, weight: "medium", color: C.t3 });
  t(k, value, { size: 20, weight: "bold", ls: -0.4 });
  if (delta) t(k, delta, { size: 12, weight: "semibold", color: up ? C.okA : C.errA });
  return k;
}
function dots(parent, idx, n = 3) {
  const d = row(parent, "Page dots", { gap: 6, cross: "CENTER" });
  for (let i = 0; i < n; i++) rect(d, "dot " + (i + 1), 0, 0, i === idx ? 22 : 8, 8, solid(i === idx ? C.p : C.p20), 4);
  return d;
}
function secondaryBtn(parent, label, o = {}) {
  const b = row(parent, "Button/" + label, { pad: [0, 20], h: o.h || 52, gap: 8, r: (o.h || 52) / 2, main: "CENTER", cross: "CENTER", fills: solid(C.white), stroke: C.border });
  if (o.icon) icon(b, o.icon, 0, 0, 18, C.heading);
  t(b, label, { size: 15, weight: "semibold" });
  if (o.fill !== false) sizing(b, "FILL", "FIXED");
  return b;
}
