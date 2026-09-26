const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "P1 · Explore passes", 0);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Passes", "info-circle-linear");
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");

// Savings banner
const ban = passArt(c, "Savings banner", { h: 88 });
const bl = row(ban, "Banner content", { gap: 12, cross: "CENTER", w: 318 }); bl.x = 16; bl.y = 18;
const bt = row(bl, "Crown", { w: 52, h: 52, r: 16, main: "CENTER", cross: "CENTER", fills: solid("#FFFFFF", 0.16) });
icon(bt, "crown1-linear", 0, 0, 26, C.white);
const bx = col(bl, "t", { gap: 3 }); bx.layoutGrow = 1;
t(bx, "Save up to 35% on every ride", { size: 17, weight: "bold", color: C.white });
t(bx, "Compared with ₹85 single rides on R-12", { size: 13, weight: "medium", color: C.p20 });

// Filter chips
const ch = row(c, "Filters", { gap: 8 });
chip(ch, "All", true); chip(ch, "Weekly", false); chip(ch, "Monthly", false); chip(ch, "Flexi", false);

// Pass list
const passes = [
  ["Weekly Saver", "10 rides  ·  7 days", "₹750", "₹850", "₹75 per ride", null, false],
  ["Monthly Commuter", "44 rides  ·  30 days", "₹2,640", "₹3,740", "₹60 per ride  ·  save 29%", "Most popular", true],
  ["Flexi 20", "20 rides  ·  60 days, any days", "₹1,440", "₹1,700", "₹72 per ride  ·  for hybrid work", null, false],
  ["Quarterly Pro", "132 rides  ·  90 days", "₹7,260", "₹11,220", "₹55 per ride  ·  save 35%", "Best value", false],
];
passes.forEach(([name, meta, price, was, per, tag, on]) => {
  const k = card(c, "Pass/" + name, { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", r: 20, flat: true, stroke: on ? C.p : C.border, fill: on ? C.p5 : C.white });
  if (on) k.strokeWeight = 1.5;
  iconTile(k, "ticket-discount-linear", on ? C.white : C.p, on ? C.p : C.p10, 42, 13);
  const tx = col(k, "Text", { gap: 3 }); tx.layoutGrow = 1;
  const nr = row(tx, "Name row", { gap: 6, cross: "CENTER" });
  t(nr, name, { size: 16, weight: "bold" });
  t(tx, meta, { size: 13, weight: "medium", color: C.t2 });
  t(tx, per, { size: 12, weight: "semibold", color: C.okA });
  const pr = col(k, "Price", { cross: "MAX", gap: 2 });
  if (tag) badge(pr, tag, tag === "Best value" ? C.okA : C.p, tag === "Best value" ? C.ok10 : C.p10);
  t(pr, price, { size: 18, weight: "bold", color: on ? C.p : C.heading });
  t(pr, was, { size: 12, weight: "medium", color: C.t4, strike: true });
});

const bb = bottomBar(s, 150);
summary(bb, "ticket-discount-linear", "Monthly Commuter  ·  ₹2,640", "44 rides  ·  30 days  ·  ₹60 per ride");
primaryBtn(bb, "View pass", { icon: "arrow-right-linear", h: 52 });
homeIndicator(s);
return { screen: "explore", id: s.id, contentBottom: c.y + c.height, barTop: bb.y };
