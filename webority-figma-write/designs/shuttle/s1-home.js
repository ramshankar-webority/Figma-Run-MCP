const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "01 · Home", 0);
backdrop(s, 420);
statusBarAL(s);
const c = col(s, "Content", { pad: [4, 20, 0, 20], gap: 18 }); sizing(c, "FILL", "HUG");

// Header
const h = row(c, "Header", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(h);
const who = row(h, "Rider", { gap: 12, cross: "CENTER" });
const av = ellipse(who, "Avatar", 0, 0, 48, 48, imgFill(img("30004322"))); av.strokes = solid(C.white); av.strokeWeight = 2.5; av.effects = [shadow(C.heading, 0.12, 4, 10)];
const g = col(who, "Greeting", { gap: 2 });
t(g, "Good morning", { size: 14, weight: "medium", color: C.t3 });
t(g, "Ananya Sharma", { size: 22, weight: "bold", ls: -0.4 });
const bell = glassBtn(h, "Notifications", 46, "notification-linear");
absolute(ellipse(bell, "Unread", 0, 0, 9, 9, solid(C.err)), 27, 11);

// Hero: next ride over shuttle photo
const hero = frame(c, "Next ride card", 0, 0, 350, 212, imgFill(img("1224759")), 28); fill(hero);
hero.effects = [shadow(C.heading, 0.14, 14, 30)];
rect(hero, "Scrim", 0, 0, 350, 212, grad([["#071437", 0, 0.25], ["#071437", 0.55, 1]], "v"));
const hb = row(hero, "Badge row", { gap: 6 }); hb.x = 16; hb.y = 16;
const conf = glassAL(hb, "Confirmed", "HORIZONTAL", { pad: [6, 12], gap: 6, r: 14, cross: "CENTER", tint: 0.7 });
ellipse(conf, "dot", 0, 0, 7, 7, solid(C.ok)); t(conf, "Confirmed", { size: 12, weight: "semibold", color: C.heading });
const gp = glassAL(hero, "Next ride glass", "HORIZONTAL", { pad: [14, 16], gap: 12, r: 22, cross: "CENTER", tint: 0.72, w: 326, strong: true }); gp.x = 12; gp.y = 120;
const gi = col(gp, "Info", { gap: 3 }); gi.layoutGrow = 1;
t(gi, "NEXT SHUTTLE  ·  TOMORROW", { size: 11, weight: "semibold", color: C.p, ls: 0.8 });
t(gi, "8:15 AM  ·  Route R-12", { size: 18, weight: "bold" });
t(gi, "Seat 7A  ·  Indiranagar Metro Gate 2", { size: 13, weight: "medium", color: C.t2 });
const go = row(gp, "Open", { w: 44, h: 44, r: 22, main: "CENTER", cross: "CENTER", fills: solid(C.p) });
icon(go, "arrow-right-linear", 0, 0, 20, C.white);

// Direction toggle
const seg = glassAL(c, "Direction toggle", "HORIZONTAL", { pad: 5, gap: 4, r: 26, h: 52, tint: 0.65, cross: "CENTER" }); sizing(seg, "FILL", "FIXED");
[["buildings2", "To office", true], ["home2", "To home", false]].forEach(([k, l, on]) => {
  const it = row(seg, "Segment/" + l, { gap: 8, main: "CENTER", cross: "CENTER", r: 21, fills: on ? solid(C.white) : [] });
  sizing(it, "FILL", "FILL");
  icon(it, k + (on ? "-bold" : "-linear"), 0, 0, 18, on ? C.p : C.t3);
  t(it, l, { size: 15, weight: on ? "semibold" : "medium", color: on ? C.heading : C.t3 });
});

// Quick book
const qb = card(c, "Quick book", { pad: 16, gap: 0 });
const legs = [["location-bold", C.p, C.p10, "PICKUP", "Indiranagar Metro Gate 2"], ["buildings2-bold", C.ok, C.ok10, "DROP", "Nexa Tech Park, Tower B"]];
legs.forEach(([k, fg, bg, lab, val], i) => {
  const r = row(qb, "Leg/" + lab, { gap: 12, cross: "CENTER", pad: [6, 0] }); fill(r);
  iconTile(r, k, fg, bg, 40, 13);
  const tx = col(r, "Text", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, lab, { size: 11, weight: "semibold", color: C.t4, ls: 0.8 });
  t(tx, val, { size: 15, weight: "semibold", color: C.heading });
  if (i === 0) { const sw = row(r, "Swap", { w: 36, h: 36, r: 18, main: "CENTER", cross: "CENTER", fills: solid(C.p5), stroke: C.p15 }); icon(sw, "arrow-swap-vertical-linear", 0, 0, 18, C.p); }
  if (i === 0) { const dv = row(qb, "Sep", { pad: [4, 0, 4, 52] }); fill(dv); divider(dv); }
});
sp(qb, 12);
primaryBtn(qb, "Book a seat", { icon: "arrow-right-linear", h: 52 });

// This week
const wk = row(c, "This week", { main: "SPACE_BETWEEN" }); fill(wk);
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
