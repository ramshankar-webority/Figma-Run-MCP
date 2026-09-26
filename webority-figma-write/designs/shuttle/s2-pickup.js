const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "02 · Pickup stop", 1);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Choose pickup", null, "Step 1 of 4");
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");

const search = glassAL(c, "Search field", "HORIZONTAL", { pad: [0, 16], gap: 10, r: 24, h: 50, cross: "CENTER", tint: 0.7 }); sizing(search, "FILL", "FIXED");
icon(search, "search-normal1-linear", 0, 0, 20, C.t3);
const st = t(search, "Search stop or area", { size: 15, weight: "medium", color: C.t4 }); st.layoutGrow = 1;
icon(search, "gps-linear", 0, 0, 20, C.p);

// Map with stops
const mapWrap = frame(c, "Map", 0, 0, 350, 212, [], 26); fill(mapWrap);
mapWrap.strokes = solid(C.white); mapWrap.strokeWeight = 3; mapWrap.strokeAlign = "INSIDE"; mapWrap.effects = soft();
const m = cityMap(mapWrap, "City map", 350, 212);
path(m, "Route R-12", "M 20 190 C 70 150 90 110 150 100 C 210 90 250 70 330 30", C.p, 5);
dotPin(m, 330, 30, C.ok, 7);
[[62, 160, false], [150, 100, true], [248, 74, false]].forEach(([x, y, on]) => on ? pin(m, x, y, C.p, "location-bold", 38) : dotPin(m, x, y, C.p, 6));
const you = ellipse(m, "You", 132, 128, 14, 14, solid(C.info)); you.strokes = solid(C.white); you.strokeWeight = 3;
const ml = glassAL(mapWrap, "Map label", "HORIZONTAL", { pad: [7, 12], gap: 6, r: 16, cross: "CENTER", tint: 0.75 }); ml.x = 12; ml.y = 12;
icon(ml, "routing2-linear", 0, 0, 16, C.p); t(ml, "Route R-12  ·  6 stops", { size: 12, weight: "semibold" });

// Stop list
const lh = row(c, "List header", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(lh);
t(lh, "Stops near you", { size: 17, weight: "bold" });
t(lh, "Sorted by walk time", { size: 13, weight: "medium", color: C.t3 });
const stops = [
  ["Indiranagar Metro Gate 2", "100 Feet Road", "4 min walk", "8:05 AM", true, "Most picked"],
  ["Domlur Flyover Bus Bay", "Old Airport Road", "9 min walk", "8:12 AM", false],
  ["HAL 2nd Stage, CMH Road", "Near Sony Signal", "12 min walk", "7:58 AM", false],
];
stops.forEach(([name, sub, walk, time, on, tag]) => {
  const k = card(c, "Stop/" + name, { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", stroke: on ? C.p : C.border, fill: on ? C.p5 : C.white, r: 20, flat: !on });
  if (on) { k.strokeWeight = 1.5; }
  const rd = row(k, "Radio", { w: 22, h: 22, r: 11, main: "CENTER", cross: "CENTER", fills: on ? solid(C.p) : solid(C.white), stroke: on ? undefined : C.t5 });
  if (on) ellipse(rd, "in", 0, 0, 8, 8, solid(C.white));
  const tx = col(k, "Text", { gap: 3 }); tx.layoutGrow = 1;
  const tr = row(tx, "Name row", { gap: 6, cross: "CENTER" });
  t(tr, name, { size: 15, weight: "semibold" });
  const meta = row(tx, "Meta", { gap: 6, cross: "CENTER" });
  icon(meta, "location-linear", 0, 0, 14, C.t3); t(meta, sub + "  ·  " + walk, { size: 13, weight: "medium", color: C.t3 });
  if (tag) { sp(tx, 2); badge(tx, tag, C.p, C.p10, { icon: "star1-bold" }); }
  const tm = col(k, "Pickup time", { cross: "MAX", gap: 2 });
  t(tm, time, { size: 15, weight: "bold", color: on ? C.p : C.heading });
  t(tm, "pickup", { size: 12, weight: "medium", color: C.t4 });
});

const bb = bottomBar(s, 112);
primaryBtn(bb, "Continue", { icon: "arrow-right-linear" });
homeIndicator(s);
return "pickup";
