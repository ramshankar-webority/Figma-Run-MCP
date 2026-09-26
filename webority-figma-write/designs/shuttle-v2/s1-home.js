const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "01 · Home", 0);
backdrop(s, 420);
statusBarAL(s);
const c = col(s, "Content", { pad: [4, 20, 0, 20], gap: 20 }); sizing(c, "FILL", "HUG");

// Header
const h = row(c, "Header", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(h);
const who = row(h, "Rider", { gap: 12, cross: "CENTER" });
const av = ellipse(who, "Avatar", 0, 0, 48, 48, imgFill(img("30004322"))); av.strokes = solid(C.white); av.strokeWeight = 2.5;
const g = col(who, "Greeting", { gap: 2 });
t(g, "Good morning", { size: 14, weight: "medium", color: C.t3 });
t(g, "Ananya Sharma", { size: 22, weight: "bold", ls: -0.4 });
const bell = glassBtn(h, "Notifications", 46, "notification-linear");
absolute(ellipse(bell, "Unread", 0, 0, 9, 9, solid(C.err)), 27, 11);

// Hero: next ride. V2: no competing arrow button; the whole card opens the ride, "Book a seat" is the one primary action.
const hero = frame(c, "Next ride card", 0, 0, 350, 172, imgFill(img("1224759")), 28); fill(hero);
rect(hero, "Scrim", 0, 0, 350, 172, grad([["#071437", 0, 0.2], ["#071437", 0.6, 1]], "v"));
const hb = row(hero, "Badge row", { gap: 6 }); hb.x = 16; hb.y = 16;
const conf = glassAL(hb, "Confirmed", "HORIZONTAL", { pad: [6, 12], gap: 6, r: 14, cross: "CENTER", tint: 0.7 });
ellipse(conf, "dot", 0, 0, 7, 7, solid(C.ok)); t(conf, "Confirmed", { size: 12, weight: "semibold", color: C.heading });
const gp = glassAL(hero, "Next ride glass", "HORIZONTAL", { pad: [14, 16], gap: 12, r: 22, cross: "CENTER", tint: 0.74, w: 326, strong: true }); gp.x = 12; gp.y = 82;
const gi = col(gp, "Info", { gap: 3 }); gi.layoutGrow = 1;
t(gi, "Tomorrow  ·  Route R-12", { size: 12, weight: "semibold", color: C.p });
t(gi, "8:15 AM  ·  Seat 7A", { size: 18, weight: "bold" });
t(gi, "Indiranagar Metro Gate 2", { size: 13, weight: "medium", color: C.t2 });
icon(gp, "arrow-right-linear", 0, 0, 20, C.t2);

// Book a ride: direction toggle now lives inside the card it controls.
const g1 = col(c, "Book a ride", { gap: 10 }); fill(g1);
sectionHead(g1, "Book a ride");
const qb = card(g1, "Quick book", { pad: 16, gap: 14 });
const seg = row(qb, "Direction toggle", { pad: 4, gap: 4, r: 21, h: 42, cross: "CENTER", fills: solid(C.dbg) }); sizing(seg, "FILL", "FIXED");
[["buildings2", "To office", true], ["home2", "To home", false]].forEach(([k, l, on]) => {
  const it = row(seg, "Segment/" + l, { gap: 8, main: "CENTER", cross: "CENTER", r: 18, fills: on ? solid(C.white) : [], stroke: on ? C.border : undefined });
  sizing(it, "FILL", "FILL");
  icon(it, k + "-linear", 0, 0, 18, on ? C.p : C.t3);
  t(it, l, { size: 14, weight: on ? "semibold" : "medium", color: on ? C.heading : C.t3 });
});
const legs = col(qb, "Legs", { gap: 0 }); fill(legs);
[["location-bold", C.p, C.p10, "Pickup", "Indiranagar Metro Gate 2"], ["buildings2-bold", C.ok, C.ok10, "Drop", "Nexa Tech Park, Tower B"]].forEach(([k, fg, bg, lab, val], i) => {
  const r = row(legs, "Leg/" + lab, { gap: 12, cross: "CENTER", pad: [4, 0] }); fill(r);
  iconTile(r, k, fg, bg, 40, 13);
  const tx = col(r, "Text", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, lab, { size: 12, weight: "medium", color: C.t3 });
  t(tx, val, { size: 15, weight: "semibold", color: C.heading });
  if (i === 0) { const sw = row(r, "Swap", { w: 36, h: 36, r: 18, main: "CENTER", cross: "CENTER", fills: solid(C.p5), stroke: C.p15 }); icon(sw, "arrow-swap-vertical-linear", 0, 0, 18, C.p); }
  if (i === 0) { const dv = row(legs, "Sep", { pad: [4, 0, 4, 52] }); fill(dv); divider(dv); }
});
primaryBtn(qb, "Book a seat", { icon: "arrow-right-linear", h: 52 });

// This week
const g2 = col(c, "This week", { gap: 10 }); fill(g2);
sectionHead(g2, "This week", "2 rides booked");
const wk = row(g2, "Week", { main: "SPACE_BETWEEN" }); fill(wk);
[["Mon", "21", "done"], ["Tue", "22", "done"], ["Wed", "23", "today"], ["Thu", "24", "booked"], ["Fri", "25", "wait"]].forEach(([d, n, st]) => {
  const on = st === "today";
  const dcol = col(wk, "Day/" + d, { w: 62, pad: [10, 0], gap: 4, r: 18, cross: "CENTER", fills: on ? solid(C.p) : solid(C.white), stroke: on ? undefined : C.border });
  t(dcol, d, { size: 12, weight: "medium", color: on ? C.p20 : C.t3 });
  t(dcol, n, { size: 17, weight: "bold", color: on ? C.white : C.heading });
  const dot = { done: C.t5, today: C.white, booked: C.ok, wait: C.warn }[st];
  ellipse(dcol, "Status", 0, 0, 6, 6, solid(dot));
});

tabBar(s, "Home");
return "home";
