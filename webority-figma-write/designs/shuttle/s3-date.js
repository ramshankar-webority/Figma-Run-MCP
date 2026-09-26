const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "03 · Date & shift", 2);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Date & shift", "calendar1-linear", "Step 2 of 4");
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 16 }); sizing(c, "FILL", "HUG");

const mh = row(c, "Month", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(mh);
t(mh, "September 2026", { size: 20, weight: "bold", ls: -0.3 });
const nav = row(mh, "Arrows", { gap: 8 });
glassBtn(nav, "Prev week", 34, "arrow-left-linear", C.t2, { iconSize: 16 });
glassBtn(nav, "Next week", 34, "arrow-right-linear", C.t2, { iconSize: 16 });

const strip = glassAL(c, "Week strip", "HORIZONTAL", { pad: 6, gap: 2, r: 26, tint: 0.65 }); fill(strip);
[["Mon", "21", "past"], ["Tue", "22", "past"], ["Wed", "23", "today"], ["Thu", "24", "sel"], ["Fri", "25", ""], ["Sat", "26", "off"], ["Sun", "27", "off"]].forEach(([d, n, stt]) => {
  const on = stt === "sel";
  const dc = col(strip, "Day/" + d + " " + n, { pad: [10, 0], gap: 5, r: 20, cross: "CENTER", fills: on ? solid(C.p) : [] });
  sizing(dc, "FILL", "HUG");
  const dim = stt === "past" || stt === "off";
  t(dc, d, { size: 12, weight: "medium", color: on ? C.p20 : dim ? C.t5 : C.t3 });
  t(dc, n, { size: 18, weight: "bold", color: on ? C.white : dim ? C.t5 : C.heading });
  ellipse(dc, "mark", 0, 0, 5, 5, solid(stt === "today" ? C.p : on ? C.white : C.white, stt === "today" || on ? 1 : 0));
});

const shiftBlock = (title, sub, times, selIdx, key) => {
  const b = col(c, title, { gap: 10 }); fill(b);
  const hh = row(b, "Header", { gap: 10, cross: "CENTER" }); fill(hh);
  iconTile(hh, key, C.p, C.p10, 34, 11);
  const tx = col(hh, "t", { gap: 1 }); tx.layoutGrow = 1;
  t(tx, title, { size: 16, weight: "bold" });
  t(tx, sub, { size: 12, weight: "medium", color: C.t3 });
  const grid = row(b, "Slots", { gap: 8, wrap: true, wrapGap: 8 }); fill(grid);
  times.forEach(([tm, seats], i) => {
    const on = i === selIdx, full = seats === 0;
    const sl = col(grid, "Slot/" + tm, { pad: [10, 12], gap: 3, r: 16, w: 81, fills: on ? solid(C.p) : solid(full ? C.dbg : C.white), stroke: on ? undefined : C.border });
    t(sl, tm, { size: 15, weight: "bold", color: on ? C.white : full ? C.t4 : C.heading });
    t(sl, full ? "Full" : seats + " seats", { size: 12, weight: "medium", color: on ? C.p20 : full ? C.err : seats <= 4 ? C.warnA : C.ok });
  });
};
shiftBlock("Login shift", "Pickup to Nexa Tech Park", [["7:30 AM", 12], ["8:15 AM", 6], ["9:00 AM", 3], ["9:45 AM", 0]], 1, "sun1-bold");
shiftBlock("Logout shift", "Return to Indiranagar Metro", [["5:30 PM", 9], ["6:30 PM", 4], ["7:30 PM", 14], ["8:30 PM", 18]], 1, "moon-bold");

const rep = card(c, "Repeat", { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", r: 20, flat: true });
iconTile(rep, "repeat-linear", C.info, C.info10, 40, 13);
const rt = col(rep, "t", { gap: 2 }); rt.layoutGrow = 1;
t(rt, "Repeat every weekday", { size: 15, weight: "semibold" });
t(rt, "Auto book Mon to Fri, same seat", { size: 12, weight: "medium", color: C.t3 });
const tog = row(rep, "Switch (on)", { w: 52, h: 32, r: 16, pad: 3, main: "MAX", cross: "CENTER", fills: solid(C.ok) });
const knob = ellipse(tog, "knob", 0, 0, 26, 26, solid(C.white)); knob.effects = [shadow(C.heading, 0.2, 2, 5)];

const warn = row(c, "Cutoff notice", { pad: [12, 14], gap: 10, r: 16, cross: "CENTER", fills: solid(C.warn10), stroke: "#FDE8B3" }); fill(warn);
icon(warn, "timer1-linear", 0, 0, 20, C.warnA);
const wt = t(warn, "Book before 8:00 PM tonight. Seats for Thursday close after that.", { size: 13, weight: "medium", color: "#7A5A00", w: 280 }); sizing(wt, "FILL", "HUG");

const bb = bottomBar(s, 112);
primaryBtn(bb, "Choose seat", { icon: "arrow-right-linear" });
homeIndicator(s);
return "date";
