const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "O9 · Profile", 8);
backdrop(s, 300);
statusBarAL(s);
const c = col(s, "Content", { pad: [4, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");
const h = row(c, "Header", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(h);
t(h, "Profile", { size: 30, weight: "bold", ls: -0.8 });
glassBtn(h, "Settings", 44, "setting2-linear");

// Identity
const idc = card(c, "Identity", { dir: "HORIZONTAL", pad: 16, gap: 14, cross: "CENTER", r: 24, flat: true });
const av = ellipse(idc, "Avatar", 0, 0, 64, 64, imgFill(img("30004322"))); av.strokes = solid(C.white); av.strokeWeight = 3;
const ix = col(idc, "t", { gap: 3 }); ix.layoutGrow = 1;
const nr = row(ix, "Name", { gap: 6, cross: "CENTER" }); t(nr, "Ananya Sharma", { size: 19, weight: "bold" }); icon(nr, "verify-linear", 0, 0, 18, C.p);
t(ix, "Product Designer", { size: 13, weight: "medium", color: C.t2 });
t(ix, "Nexa Technologies  ·  NX-20418", { size: 12, weight: "medium", color: C.t3 });
const ed = row(idc, "Edit", { w: 38, h: 38, r: 19, main: "CENTER", cross: "CENTER", fills: solid(C.p10) }); icon(ed, "edit2-linear", 0, 0, 18, C.p);

// Stats
const st = row(c, "Stats", { gap: 10 }); fill(st);
kpi(st, "Rides", "86", "since June", true, "bus-linear");
kpi(st, "Saved", "₹2,150", "with passes", true, "money-recive-linear");
kpi(st, "CO₂ saved", "142 kg", "vs driving", true, "star-linear");

// Pass strip
const ps = passArt(c, "Pass strip", { h: 64 });
const pr = row(ps, "Pass row", { w: 318, gap: 12, cross: "CENTER" }); pr.x = 16; pr.y = 12;
const pt = row(pr, "Tile", { w: 40, h: 40, r: 13, main: "CENTER", cross: "CENTER", fills: solid("#FFFFFF", 0.18) }); icon(pt, "ticket-discount-linear", 0, 0, 20, C.white);
const px = col(pr, "t", { gap: 1 }); px.layoutGrow = 1;
t(px, "Monthly Commuter", { size: 15, weight: "bold", color: C.white }); t(px, "31 rides left  ·  till 23-Oct", { size: 12, weight: "medium", color: C.p20 });
icon(pr, "arrow-right-linear", 0, 0, 18, C.white);

// Settings list
const ls = card(c, "Settings", { pad: [2, 16], gap: 0, r: 22, flat: true });
listRow(ls, "routing2-linear", C.p, C.p10, "Commute preferences", "R-12  ·  8:15 AM and 6:30 PM");
divider(ls, C.lborder);
listRow(ls, "card-linear", C.info, C.info10, "Payments and invoices", "UPI  ·  2 cards saved");
divider(ls, C.lborder);
listRow(ls, "language-square-linear", C.okA, C.ok10, "Language", null, "English");
divider(ls, C.lborder);
listRow(ls, "message-question-linear", C.warnA, C.warn10, "Help and safety", "24x7 support, SOS contacts");
divider(ls, C.lborder);
listRow(ls, "logout-linear", C.errA, C.err10, "Log out", null, null, { danger: true, noChevron: true });

tabBar(s, "Profile");
return { profile: s.id, contentBottom: c.y + c.height };
