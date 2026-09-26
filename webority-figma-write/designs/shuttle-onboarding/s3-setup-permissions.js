const section = await figma.getNodeByIdAsync(SECTION_ID);

// Set up commute
const s = screenAL(section, "O7 · Set up commute", 6);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Your commute", null, 3);
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");
const co = card(c, "Company", { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", r: 20, flat: true, fill: C.ok10, stroke: "#C9F0D6" });
iconTile(co, "briefcase-linear", C.okA, C.white, 42, 13);
const cx = col(co, "t", { gap: 2 }); cx.layoutGrow = 1;
t(cx, "Nexa Technologies", { size: 16, weight: "bold" }); t(cx, "Verified from your work number", { size: 12, weight: "medium", color: C.t2 });
icon(co, "verify-linear", 0, 0, 22, C.okA);

const rg = col(c, "Route", { gap: 10 }); fill(rg);
sectionHead(rg, "Your route", "Change", true);
const rc = card(rg, "Legs", { pad: [4, 16], gap: 0, r: 22, flat: true });
listRow(rc, "location-linear", C.p, C.p10, "Indiranagar Metro Gate 2", "Pickup  ·  4 min walk from home", null, { noChevron: true });
divider(rc, C.lborder);
listRow(rc, "buildings2-linear", C.okA, C.ok10, "Nexa Tech Park, Tower B", "Drop  ·  Whitefield Main Road", null, { noChevron: true });

const sh = col(c, "Shift", { gap: 10 }); fill(sh);
sectionHead(sh, "Usual shift");
const sr = row(sh, "Shift times", { gap: 10 }); fill(sr);
[["sun1-linear", "Login", "8:15 AM"], ["moon-linear", "Logout", "6:30 PM"]].forEach(([k, l, v]) => {
  const b = row(sr, l, { pad: 14, gap: 10, r: 18, cross: "CENTER", fills: solid(C.white), stroke: C.border }); sizing(b, "FILL", "HUG");
  iconTile(b, k, C.p, C.p10, 36, 12);
  const bx = col(b, "t", { gap: 1 }); t(bx, l, { size: 12, weight: "medium", color: C.t3 }); t(bx, v, { size: 16, weight: "bold" });
});

const wd = col(c, "Work days", { gap: 10 }); fill(wd);
sectionHead(wd, "Work days", "5 days a week");
const dr = row(wd, "Days", { main: "SPACE_BETWEEN" }); fill(dr);
[["M", 1], ["T", 1], ["W", 1], ["T", 1], ["F", 1], ["S", 0], ["S", 0]].forEach(([d, on], i) => {
  const b = row(dr, "Day " + (i + 1), { w: 44, h: 44, r: 22, main: "CENTER", cross: "CENTER", fills: solid(on ? C.p : C.white), stroke: on ? undefined : C.border });
  t(b, d, { size: 15, weight: "semibold", color: on ? C.white : C.t3 });
});
const bb = bottomBar(s, 124);
primaryBtn(bb, "Continue", { icon: "arrow-right-linear", h: 52 });
const nt = t(bb, "You can change these any time in Profile.", { size: 12, weight: "medium", color: C.t3, align: "CENTER" }); sizing(nt, "FILL", "HUG");
homeIndicator(s);

// Permissions
const p = screenAL(section, "O8 · Permissions", 7);
backdrop(p, 420);
statusBarAL(p);
navBar(p, "Permissions", null, 4);
const pc = col(p, "Content", { pad: [8, 20, 0, 20], gap: 18, cross: "CENTER" }); sizing(pc, "FILL", "HUG");
const hero = glassAL(pc, "Hero", "HORIZONTAL", { w: 120, h: 120, r: 60, main: "CENTER", cross: "CENTER", tint: 0.6, strong: true });
const inr = row(hero, "Inner", { w: 84, h: 84, r: 42, main: "CENTER", cross: "CENTER", fills: solid(C.p) }); icon(inr, "notification-linear", 0, 0, 40, C.white);
const ph = col(pc, "Heading", { gap: 6, cross: "CENTER" }); fill(ph);
t(ph, "Never miss your shuttle", { size: 26, weight: "bold", ls: -0.5, align: "CENTER" });
t(ph, "Two permissions keep your pickup on time. You stay in control.", { size: 15, weight: "medium", color: C.t2, align: "CENTER", w: 320, lh: 22 });
[["gps-linear", C.p, C.p10, "Location", "Live ETA and a reminder when you are near your stop"], ["notification-linear", C.warnA, C.warn10, "Notifications", "Booking, delay and boarding alerts"]].forEach(([k, fg, bg, a, b]) => {
  const k2 = card(pc, a, { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", r: 20, flat: true });
  iconTile(k2, k, fg, bg, 42, 13);
  const tx = col(k2, "t", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, a, { size: 15, weight: "semibold" }); t(tx, b, { size: 12, weight: "medium", color: C.t3, w: 200 });
  toggle(k2, true);
});
const pv = row(pc, "Privacy", { pad: [12, 14], gap: 10, r: 16, cross: "CENTER", fills: solid(C.p5) }); fill(pv);
icon(pv, "shield-security-linear", 0, 0, 20, C.p);
const pvt = t(pv, "We use your location only while a ride is booked or active.", { size: 13, weight: "medium", color: C.t1, w: 280 }); sizing(pvt, "FILL", "HUG");
const pb = bottomBar(p, 136);
primaryBtn(pb, "Allow and continue", { icon: "arrow-right-linear", h: 52 });
const nn = t(pb, "Not now", { size: 15, weight: "semibold", color: C.t2, align: "CENTER" }); sizing(nn, "FILL", "HUG");
homeIndicator(p);
return { setup: s.id, setupBottom: c.y + c.height, setupBar: bb.y, perms: p.id, permsBottom: pc.y + pc.height, permsBar: pb.y };
