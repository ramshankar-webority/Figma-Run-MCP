const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "07 · My rides", 6);
backdrop(s, 300);
statusBarAL(s);
const c = col(s, "Content", { pad: [4, 20, 0, 20], gap: 16 }); sizing(c, "FILL", "HUG");
const h = row(c, "Header", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(h);
t(h, "My rides", { size: 30, weight: "bold", ls: -0.8 });
glassBtn(h, "Filter", 44, "filter-linear");

const seg = glassAL(c, "Tabs", "HORIZONTAL", { pad: 4, gap: 4, r: 23, h: 46, tint: 0.65, cross: "CENTER" }); sizing(seg, "FILL", "FIXED");
[["Upcoming", true, "3"], ["Past", false], ["Cancelled", false]].forEach(([l, on, n]) => {
  const it = row(seg, "Tab/" + l, { gap: 6, main: "CENTER", cross: "CENTER", r: 19, fills: on ? solid(C.white) : [] });
  sizing(it, "FILL", "FILL");
  t(it, l, { size: 14, weight: on ? "semibold" : "medium", color: on ? C.heading : C.t3 });
  if (n) { const bd = row(it, "count", { w: 20, h: 20, r: 10, main: "CENTER", cross: "CENTER", fills: solid(C.p) }); t(bd, n, { size: 12, weight: "bold", color: C.white }); }
});

// V2: rides grouped under a day heading, so each card no longer repeats the date.
const rides = [
  ["Thursday, 24-Sep", "8:15 AM", "To office", "Indiranagar Metro Gate 2", "Nexa Tech Park, Tower B", "7A", "Confirmed", C.okA, C.ok10, "buildings2-bold"],
  ["Thursday, 24-Sep", "6:30 PM", "To home", "Nexa Tech Park, Tower B", "Indiranagar Metro Gate 2", "9C", "Confirmed", C.okA, C.ok10, "home2-bold"],
  ["Friday, 25-Sep", "8:15 AM", "To office", "Indiranagar Metro Gate 2", "Nexa Tech Park, Tower B", "-", "Waitlist #2", C.warnA, C.warn10, "buildings2-bold"],
];
let group = null, lastDay = "";
rides.forEach(([d, tm, dir, from, to, seat, stt, fg, bg, ik], i) => {
  if (d !== lastDay) {
    group = col(c, "Day/" + d, { gap: 10 }); fill(group);
    sectionHead(group, d, rides.filter((r) => r[0] === d).length + (rides.filter((r) => r[0] === d).length > 1 ? " rides" : " ride"));
    lastDay = d;
  }
  const k = card(group, "Ride/" + d + " " + tm, { pad: 14, gap: 12, r: 22, flat: true });
  const hr = row(k, "Head", { gap: 12, cross: "CENTER" }); fill(hr);
  iconTile(hr, ik, C.p, C.p10, 40, 13);
  const tx = col(hr, "t", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, tm + "  ·  " + dir, { size: 16, weight: "bold" });
  t(tx, "R-12  ·  " + (seat === "-" ? "Seat on confirmation" : "Seat " + seat), { size: 12, weight: "medium", color: C.t3 });
  badge(hr, stt, fg, bg, { dot: true });
  const rt = row(k, "Route", { pad: [9, 12], gap: 8, r: 12, cross: "CENTER", fills: solid(C.dbg) }); fill(rt);
  ellipse(rt, "from", 0, 0, 8, 8, solid(C.p));
  const f1 = t(rt, from, { size: 12, weight: "medium", color: C.t1 }); f1.layoutGrow = 1;
  icon(rt, "arrow-right-linear", 0, 0, 14, C.t3);
  const f2 = t(rt, to, { size: 12, weight: "medium", color: C.t1, align: "RIGHT" }); f2.layoutGrow = 1;
  if (i === 0) {
    const ac = row(k, "Actions", { gap: 8 }); fill(ac);
    const r1 = row(ac, "Reschedule", { h: 40, r: 20, gap: 6, main: "CENTER", cross: "CENTER", fills: solid(C.white), stroke: C.border }); sizing(r1, "FILL", "FIXED");
    icon(r1, "calendar1-linear", 0, 0, 16, C.t1); t(r1, "Reschedule", { size: 13, weight: "semibold", color: C.t1 });
    const r2 = row(ac, "Cancel", { h: 40, r: 20, gap: 6, main: "CENTER", cross: "CENTER", fills: solid(C.err10) }); sizing(r2, "FILL", "FIXED");
    icon(r2, "close-circle-linear", 0, 0, 16, C.errA); t(r2, "Cancel", { size: 13, weight: "semibold", color: C.errA });
    const r3 = row(ac, "Pass", { h: 40, w: 40, r: 20, main: "CENTER", cross: "CENTER", fills: solid(C.p) });
    icon(r3, "scan-barcode-linear", 0, 0, 18, C.white);
  }
});

tabBar(s, "My Rides");
return { screen: "rides", contentBottom: c.y + c.height };
