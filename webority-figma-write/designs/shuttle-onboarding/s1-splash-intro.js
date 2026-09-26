const section = await figma.getNodeByIdAsync(SECTION_ID);
const place = (n, x, y) => { n.x = x; n.y = y; return n; }; // for children of plain (non auto-layout) frames

// Splash
const sp0 = screenAL(section, "O1 · Splash", 0);
sp0.fills = grad([["#193EE4", 1, 0], ["#2F50E4", 1, 0.5], ["#1B84FF", 1, 1]], "v");
const g1 = absolute(ellipse(sp0, "Glow", 0, 0, 360, 360, solid("#FFFFFF", 0.14)), -120, -80); g1.effects = [blur(90)];
const g2 = absolute(ellipse(sp0, "Glow 2", 0, 0, 320, 320, solid("#97A8F2", 0.35)), 170, 560); g2.effects = [blur(90)];
statusBarAL(sp0, C.white);
const mid = absolute(col(sp0, "Brand", { gap: 18, cross: "CENTER", w: 390 }), 0, 300);
const logo = row(mid, "Logo", { w: 96, h: 96, r: 30, main: "CENTER", cross: "CENTER", fills: solid(C.white) });
icon(logo, "bus-bold", 0, 0, 48, C.p);
const nameCol = col(mid, "Name", { gap: 6, cross: "CENTER" });
t(nameCol, "OfficeLoop", { size: 38, weight: "bold", color: C.white, ls: -1 });
t(nameCol, "Your office commute, sorted.", { size: 16, weight: "medium", color: C.p20 });
const foot = absolute(col(sp0, "Footer", { gap: 14, cross: "CENTER", w: 390 }), 0, 736);
const ld = row(foot, "Loader", { gap: 6 });
[1, 0.6, 0.3].forEach((o, i) => ellipse(ld, "dot " + (i + 1), 0, 0, 8, 8, solid(C.white, o)));
t(foot, "by Nexa Mobility", { size: 13, weight: "medium", color: C.p20 });
absolute(rect(sp0, "Home indicator", 0, 0, 134, 5, solid(C.white), 3), 128, 831);

// Intro screens
const intros = [
  ["Book your seat in 10 seconds", "Pick your stop, shift and seat. Your boarding pass is ready before your coffee is."],
  ["Track your shuttle live", "See exactly where your shuttle is and get a nudge when it is 5 minutes from your stop."],
  ["Save with commute passes", "Ride for as little as ₹55 a trip, with your company paying part of the pass."],
];
intros.forEach(([title, body], i) => {
  const s = screenAL(section, "O" + (i + 2) + " · Intro " + (i + 1), i + 1);
  backdrop(s, 420);
  statusBarAL(s);
  const top = row(s, "Top", { pad: [6, 24, 0, 24], main: "SPACE_BETWEEN", cross: "CENTER", h: 44 }); sizing(top, "FILL", "FIXED");
  const br = row(top, "Brand", { gap: 8, cross: "CENTER" });
  const lg = row(br, "Logo", { w: 30, h: 30, r: 10, main: "CENTER", cross: "CENTER", fills: solid(C.p) }); icon(lg, "bus-bold", 0, 0, 16, C.white);
  t(br, "OfficeLoop", { size: 16, weight: "bold" });
  t(top, i < 2 ? "Skip" : "", { size: 15, weight: "semibold", color: C.t2 });
  const c = col(s, "Content", { pad: [16, 20, 0, 20], gap: 26 }); sizing(c, "FILL", "HUG");

  // Illustration
  const art = frame(c, "Illustration", 0, 0, 350, 400, [], 32); fill(art);
  art.strokes = solid(C.border); art.strokeWeight = 1; art.strokeAlign = "INSIDE";
  if (i === 0) {
    art.fills = imgFill(img("1224759"));
    rect(art, "Scrim", 0, 0, 350, 400, grad([["#071437", 0, 0.35], ["#071437", 0.55, 1]], "v"));
    const cardA = place(glassAL(art, "Booked card", "HORIZONTAL", { pad: [14, 16], gap: 12, r: 22, cross: "CENTER", tint: 0.78, strong: true, w: 318 }), 16, 300);
    iconTile(cardA, "tick-circle-linear", C.okA, C.ok10, 40, 13);
    const tx = col(cardA, "t", { gap: 2 }); tx.layoutGrow = 1;
    t(tx, "Seat 7A confirmed", { size: 16, weight: "bold" }); t(tx, "Tomorrow  ·  8:15 AM  ·  Route R-12", { size: 12, weight: "medium", color: C.t2 });
    const chipA = place(glassAL(art, "Time chip", "HORIZONTAL", { pad: [7, 12], gap: 6, r: 16, cross: "CENTER", tint: 0.8 }), 16, 16);
    icon(chipA, "clock-linear", 0, 0, 14, C.p); t(chipA, "Booked in 8 s", { size: 12, weight: "semibold" });
  } else if (i === 1) {
    const m = cityMap(art, "Map", 350, 400);
    path(m, "Route", "M 30 380 C 80 300 60 240 130 200 C 200 160 230 120 320 40", C.p, 6);
    ellipse(m, "Halo", 100, 190, 76, 76, solid(C.p, 0.14));
    const sh = frame(m, "Shuttle", 116, 206, 44, 44, solid(C.p), 22); sh.clipsContent = false;
    sh.strokes = solid(C.white); sh.strokeWeight = 3; sh.strokeAlign = "OUTSIDE"; icon(sh, "bus-bold", 11, 11, 22, C.white);
    pin(m, 300, 70, C.ok, "location-bold", 40);
    const eta = place(glassAL(art, "ETA", "HORIZONTAL", { pad: [10, 14], gap: 8, r: 20, cross: "CENTER", tint: 0.82, strong: true }), 16, 16);
    ellipse(eta, "live", 0, 0, 8, 8, solid(C.ok)); t(eta, "Arriving in 5 min", { size: 14, weight: "semibold" });
  } else {
    art.fills = grad([[C.p10, 1, 0], [C.bg, 1, 1]], "v");
    const pa = place(passArt(art, "Pass", { w: 290, h: 170 }), 30, 90);
    pa.rotation = 6;
    const nm = col(pa, "Name", { gap: 3 }); nm.x = 18; nm.y = 22;
    t(nm, "Monthly Commuter", { size: 20, weight: "bold", color: C.white });
    t(nm, "44 rides  ·  30 days", { size: 13, weight: "medium", color: C.p20 });
    const ppr = row(pa, "Price", { gap: 6, cross: "MAX" }); ppr.x = 18; ppr.y = 112;
    t(ppr, "₹60", { size: 28, weight: "bold", color: C.white }); t(ppr, "per ride", { size: 13, weight: "semibold", color: C.p20 });
    const s1 = place(glassAL(art, "Save chip", "HORIZONTAL", { pad: [9, 14], gap: 8, r: 20, cross: "CENTER", tint: 0.85, strong: true }), 24, 300);
    icon(s1, "discount-shape-linear", 0, 0, 18, C.okA); t(s1, "Save up to 35%", { size: 14, weight: "semibold" });
    const s2 = place(glassAL(art, "Subsidy chip", "HORIZONTAL", { pad: [9, 14], gap: 8, r: 20, cross: "CENTER", tint: 0.85, strong: true }), 150, 346);
    icon(s2, "briefcase-linear", 0, 0, 18, C.p); t(s2, "Company pays 50%", { size: 14, weight: "semibold" });
  }

  const tx = col(c, "Copy", { gap: 10 }); fill(tx);
  t(tx, title, { size: 28, weight: "bold", ls: -0.6, w: 330 });
  t(tx, body, { size: 16, weight: "medium", color: C.t2, w: 330, lh: 24 });

  const bot = absolute(row(s, "Controls", { pad: [0, 24], main: "SPACE_BETWEEN", cross: "CENTER", w: 390, h: 64 }), 0, 736);
  dots(bot, i, 3);
  if (i < 2) {
    const nx = row(bot, "Next", { w: 64, h: 64, r: 32, main: "CENTER", cross: "CENTER", fills: solid(C.p) }); icon(nx, "arrow-right-linear", 0, 0, 24, C.white);
  } else primaryBtn(bot, "Get started", { fill: false, h: 56, icon: "arrow-right-linear" });
  homeIndicator(s);
});
return "splash + intro";
