const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "P2 · Pass details", 1);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Pass details", "export-linear");
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");

// Pass art
const art = passArt(c, "Pass card", { h: 176 });
const top = row(art, "Top", { w: 318, main: "SPACE_BETWEEN", cross: "CENTER" }); top.x = 16; top.y = 16;
const brand = row(top, "Brand", { gap: 6, cross: "CENTER" }); icon(brand, "bus-bold", 0, 0, 18, C.white); t(brand, "OfficeLoop Pass", { size: 13, weight: "semibold", color: C.white });
const pop = row(top, "Popular", { pad: [5, 10], r: 12, fills: solid("#FFFFFF", 0.18) }); t(pop, "Most popular", { size: 12, weight: "semibold", color: C.white });
const mid = col(art, "Name", { gap: 3 }); mid.x = 16; mid.y = 58;
t(mid, "Monthly Commuter", { size: 24, weight: "bold", color: C.white, ls: -0.4 });
t(mid, "44 rides  ·  valid 30 days  ·  any route", { size: 13, weight: "medium", color: C.p20 });
const pr = row(art, "Price", { gap: 8, cross: "MAX" }); pr.x = 16; pr.y = 124;
t(pr, "₹2,640", { size: 28, weight: "bold", color: C.white, ls: -0.6 });
t(pr, "₹60 per ride", { size: 13, weight: "semibold", color: C.p20 });

// Included
const inc = col(c, "Included", { gap: 10 }); fill(inc);
sectionHead(inc, "What's included");
const il = card(inc, "Included list", { pad: [6, 16], gap: 0, r: 22, flat: true });
[["44 rides on any OfficeLoop route", "R-12, R-7 and weekend shuttles"], ["Priority seat booking", "Book up to 48 h before other riders"], ["Free cancellation", "Up to 30 min before pickup, ride returned"], ["Unused rides roll over", "Up to 4 rides carry into your next month"]].forEach(([a, b], i) => {
  if (i) divider(il, C.lborder);
  const r = row(il, a, { pad: [10, 0], gap: 12, cross: "CENTER" }); fill(r);
  icon(r, "tick-circle-linear", 0, 0, 20, C.okA);
  const tx = col(r, "t", { gap: 1 }); tx.layoutGrow = 1;
  t(tx, a, { size: 14, weight: "semibold" }); t(tx, b, { size: 12, weight: "medium", color: C.t3 });
});

// Start date
const st = card(c, "Starts on", { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", r: 20, flat: true });
iconTile(st, "calendar1-linear", C.p, C.p10, 40, 13);
const sx = col(st, "t", { gap: 2 }); sx.layoutGrow = 1;
t(sx, "Starts Thu, 24-Sep-2026", { size: 15, weight: "semibold" });
t(sx, "Valid till Fri, 23-Oct-2026", { size: 12, weight: "medium", color: C.t3 });
t(st, "Change", { size: 13, weight: "semibold", color: C.p });

const bb = bottomBar(s, 124);
primaryBtn(bb, "Buy pass  ·  ₹2,640", { icon: "arrow-right-linear", h: 52 });
const note = t(bb, "Nexa pays 50% of your pass. You will see it at checkout.", { size: 12, weight: "medium", color: C.t3, align: "CENTER" }); sizing(note, "FILL", "HUG");
homeIndicator(s);
return { screen: "details", id: s.id, contentBottom: c.y + c.height, barTop: bb.y };
