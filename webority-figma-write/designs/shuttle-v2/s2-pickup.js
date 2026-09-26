const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "02 · Pickup stop", 1);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Choose pickup", null, 1);
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");

const search = glassAL(c, "Search field", "HORIZONTAL", { pad: [0, 16], gap: 10, r: 25, h: 50, cross: "CENTER", tint: 0.7 }); sizing(search, "FILL", "FIXED");
icon(search, "search-normal1-linear", 0, 0, 20, C.t3);
const st = t(search, "Search stop or area", { size: 15, weight: "medium", color: C.t3 }); st.layoutGrow = 1;
icon(search, "gps-linear", 0, 0, 20, C.p);

// Map with stops (shorter in V2 so the list starts higher)
const mapWrap = frame(c, "Map", 0, 0, 350, 170, [], 24); fill(mapWrap);
mapWrap.strokes = solid(C.border); mapWrap.strokeWeight = 1; mapWrap.strokeAlign = "INSIDE";
const m = cityMap(mapWrap, "City map", 350, 170);
path(m, "Route R-12", "M 20 160 C 70 125 90 95 150 85 C 210 75 250 55 330 25", C.p, 5);
dotPin(m, 330, 25, C.ok, 7);
[[62, 132, false], [150, 85, true], [248, 60, false]].forEach(([x, y, on]) => on ? pin(m, x, y, C.p, "location-bold", 38) : dotPin(m, x, y, C.p, 6));
const you = ellipse(m, "You", 132, 108, 14, 14, solid(C.info)); you.strokes = solid(C.white); you.strokeWeight = 3;
const ml = glassAL(mapWrap, "Map label", "HORIZONTAL", { pad: [7, 12], gap: 6, r: 16, cross: "CENTER", tint: 0.78 }); ml.x = 12; ml.y = 12;
icon(ml, "routing2-linear", 0, 0, 16, C.p); t(ml, "Route R-12  ·  6 stops", { size: 12, weight: "semibold" });

// Stop list
const list = col(c, "Stops", { gap: 10 }); fill(list);
sectionHead(list, "Stops near you", "Sorted by walk time");
const stops = [
  ["Indiranagar Metro Gate 2", "100 Feet Road", "4 min walk", "8:05 AM", true, "Most picked"],
  ["Domlur Flyover Bus Bay", "Old Airport Road", "9 min walk", "8:12 AM", false],
  ["HAL 2nd Stage, CMH Road", "Near Sony Signal", "12 min walk", "7:58 AM", false],
];
stops.forEach(([name, sub, walk, time, on, tag]) => {
  const k = card(list, "Stop/" + name, { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", stroke: on ? C.p : C.border, fill: on ? C.p5 : C.white, r: 20, flat: true });
  if (on) k.strokeWeight = 1.5;
  const rd = row(k, "Radio", { w: 22, h: 22, r: 11, main: "CENTER", cross: "CENTER", fills: on ? solid(C.p) : solid(C.white), stroke: on ? undefined : C.t5 });
  if (on) ellipse(rd, "in", 0, 0, 8, 8, solid(C.white));
  const tx = col(k, "Text", { gap: 3 }); tx.layoutGrow = 1;
  const tr = row(tx, "Name row", { gap: 6, cross: "CENTER" });
  t(tr, name, { size: 15, weight: "semibold" });
  t(tx, sub + "  ·  " + walk, { size: 13, weight: "medium", color: C.t3 });
  if (tag) { sp(tx, 2); badge(tx, tag, C.p, C.p10, { icon: "star1-bold" }); }
  const tm = col(k, "Pickup time", { cross: "MAX", gap: 2 });
  t(tm, time, { size: 15, weight: "bold", color: on ? C.p : C.heading });
  t(tm, "pickup", { size: 12, weight: "medium", color: C.t3 });
});

// V2: the bottom bar repeats the choice, so the rider confirms what they are continuing with.
const bb = bottomBar(s, 150);
summary(bb, "location-bold", "Indiranagar Metro Gate 2", "Pickup 8:05 AM  ·  4 min walk");
primaryBtn(bb, "Continue", { icon: "arrow-right-linear", h: 52 });
homeIndicator(s);
return { screen: "pickup", contentBottom: c.y + c.height, barTop: bb.y };
