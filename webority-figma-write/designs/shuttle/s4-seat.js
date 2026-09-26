const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "04 · Seat selection", 3);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Select seat", null, "Step 3 of 4  ·  R-12  ·  8:15 AM");
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 12 }); sizing(c, "FILL", "HUG");

// Vehicle strip with photo
const v = frame(c, "Vehicle", 0, 0, 350, 92, imgFill(img("29450986")), 22); fill(v);
rect(v, "Scrim", 0, 0, 350, 92, grad([["#071437", 0.65, 0], ["#071437", 0.05, 0.85]], "h"));
const vt = col(v, "Vehicle text", { gap: 3 }); vt.x = 16; vt.y = 18;
t(vt, "AC Tempo Traveller", { size: 17, weight: "bold", color: C.white });
t(vt, "KA 03 AB 4521  ·  26 seats  ·  Wi-Fi", { size: 13, weight: "medium", color: "#DDE3F5" });
const left = glassAL(v, "Seats left", "HORIZONTAL", { pad: [6, 11], gap: 5, r: 14, cross: "CENTER", tint: 0.75 }); left.x = 232; left.y = 50;
ellipse(left, "dot", 0, 0, 7, 7, solid(C.warn)); t(left, "6 seats left", { size: 12, weight: "semibold" });

// Legend
const lg = row(c, "Legend", { gap: 16, main: "CENTER", cross: "CENTER" }); fill(lg);
[["Available", C.white, C.t5], ["Selected", C.p, C.p], ["Booked", C.dbg, C.border], ["Women only", C.err10, "#FDBFCE"]].forEach(([l, f, st]) => {
  const it = row(lg, "Legend/" + l, { gap: 6, cross: "CENTER" });
  const sw = rect(it, "swatch", 0, 0, 14, 14, solid(f), 4); sw.strokes = solid(st); sw.strokeWeight = 1.2;
  t(it, l, { size: 12, weight: "medium", color: C.t2 });
});

// Seat map
const map = col(c, "Seat map", { pad: [14, 26, 16, 26], gap: 8, r: 30, fills: solid(C.white), stroke: C.border, effects: soft(), cross: "CENTER" }); fill(map);
const front = row(map, "Front", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(front);
const door = row(front, "Door", { pad: [6, 10], gap: 6, r: 10, cross: "CENTER", fills: solid(C.p5) }); icon(door, "direct-right-linear", 0, 0, 14, C.p); t(door, "Door", { size: 11, weight: "semibold", color: C.p });
const drv = row(front, "Driver", { w: 40, h: 40, r: 20, main: "CENTER", cross: "CENTER", fills: solid(C.dbg), stroke: C.border }); 
const wheel = ellipse(drv, "wheel", 0, 0, 22, 22, []); wheel.strokes = solid(C.t3); wheel.strokeWeight = 3;
divider(map, C.lborder);
const booked = new Set(["1A", "1B", "2C", "2D", "3A", "4B", "4C", "5D", "6A", "6B", "8C"]);
const women = new Set(["1C", "1D", "2A", "2B"]);
const seat = (parent, id) => {
  const on = id === "7A", b = booked.has(id), w = women.has(id);
  const fillc = on ? C.p : b ? C.dbg : w ? C.err10 : C.white;
  const strokec = on ? C.p : b ? C.border : w ? "#FDBFCE" : C.t5;
  const st = col(parent, "Seat/" + id + (on ? " (selected)" : b ? " (booked)" : ""), { w: 50, h: 44, r: 12, main: "CENTER", cross: "CENTER", fills: solid(fillc), stroke: strokec });
  st.strokeWeight = 1.2;
  const back = absolute(rect(st, "Backrest", 0, 0, 30, 4, solid(on ? C.white : strokec, on ? 0.55 : 1), 2), 10, 5);
  if (b) icon(st, "user-bold", 0, 0, 16, C.t5);
  else t(st, id, { size: 13, weight: "semibold", color: on ? C.white : w ? C.errA : C.t1 });
  return st;
};
for (let r = 1; r <= 7; r++) {
  const rw = row(map, "Row " + r, { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(rw);
  const L = row(rw, "Left pair", { gap: 8 }); seat(L, r + "A"); seat(L, r + "B");
  t(rw, String(r), { size: 11, weight: "semibold", color: C.t5 });
  const R = row(rw, "Right pair", { gap: 8 }); seat(R, r + "C"); seat(R, r + "D");
}

const bb = bottomBar(s, 124);
const info = row(bb, "Selection", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(info);
const sel = row(info, "Seat", { gap: 10, cross: "CENTER" });
const tag = row(sel, "Seat tag", { w: 42, h: 42, r: 13, main: "CENTER", cross: "CENTER", fills: solid(C.p10) }); t(tag, "7A", { size: 15, weight: "bold", color: C.p });
const st = col(sel, "t", { gap: 1 }); t(st, "Window seat, row 7", { size: 15, weight: "semibold" }); t(st, "Left side  ·  Morning sun", { size: 12, weight: "medium", color: C.t3 });
primaryBtn(info, "Continue", { fill: false, h: 50 });
homeIndicator(s);
return "seat";
