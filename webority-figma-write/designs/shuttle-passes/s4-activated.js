const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "P4 · Pass activated", 3);
absolute(rect(s, "Backdrop/wash", 0, 0, 390, 520, grad([[C.ok10, 1, 0], [C.bg, 1, 1]], "v")), 0, 0);
const b1 = absolute(ellipse(s, "Backdrop/blob", 0, 0, 300, 240, solid(C.ok, 0.2)), 45, 40); b1.effects = [blur(80)];
statusBarAL(s);
const c = col(s, "Content", { pad: [10, 20, 0, 20], gap: 16, cross: "CENTER" }); sizing(c, "FILL", "HUG");

const ringG = glassAL(c, "Success ring", "HORIZONTAL", { w: 88, h: 88, r: 44, main: "CENTER", cross: "CENTER", tint: 0.55, strong: true });
const inr = row(ringG, "Tick", { w: 62, h: 62, r: 31, main: "CENTER", cross: "CENTER", fills: solid(C.ok) });
icon(inr, "tick-circle-bold", 0, 0, 34, C.white);
const ht = col(c, "Headline", { gap: 4, cross: "CENTER" });
t(ht, "Pass activated!", { size: 28, weight: "bold", ls: -0.6 });
t(ht, "44 rides are ready. Book your first one now.", { size: 14, weight: "medium", color: C.t2 });

// Digital pass
const art = passArt(c, "Digital pass", { h: 200 });
const top = row(art, "Top", { w: 318, main: "SPACE_BETWEEN", cross: "CENTER" }); top.x = 16; top.y = 16;
const brand = row(top, "Brand", { gap: 6, cross: "CENTER" }); icon(brand, "bus-bold", 0, 0, 18, C.white); t(brand, "OfficeLoop Pass", { size: 13, weight: "semibold", color: C.white });
const act = row(top, "Active", { pad: [5, 10], gap: 6, r: 12, cross: "CENTER", fills: solid("#FFFFFF", 0.18) }); ellipse(act, "dot", 0, 0, 7, 7, solid(C.ok)); t(act, "Active", { size: 12, weight: "semibold", color: C.white });
const nm = col(art, "Name", { gap: 3 }); nm.x = 16; nm.y = 56;
t(nm, "Monthly Commuter", { size: 22, weight: "bold", color: C.white });
t(nm, "Ananya Sharma  ·  NX-20418", { size: 13, weight: "medium", color: C.p20 });
const dg = row(art, "Details", { w: 318, main: "SPACE_BETWEEN" }); dg.x = 16; dg.y = 132;
[["Valid from", "24-Sep-2026"], ["Valid till", "23-Oct-2026"], ["Rides", "44 / 44"]].forEach(([l, v]) => { const cc = col(dg, l, { gap: 2 }); t(cc, l, { size: 12, weight: "medium", color: C.p20 }); t(cc, v, { size: 15, weight: "bold", color: C.white }); });

// Receipt
const rc = card(c, "Receipt", { pad: [4, 16], gap: 0, r: 22, flat: true });
listRow(rc, "receipt1-linear", C.p, C.p10, "Paid ₹1,247.40 by UPI", "Payment ID OLP-P-2409-118", null, { noChevron: true });
divider(rc, C.lborder);
listRow(rc, "flash-linear", C.okA, C.ok10, "Auto-renew is on", "Renews 23-Oct for about ₹1,247.40", null, { noChevron: true });

const acts = row(c, "Actions", { gap: 10 }); fill(acts);
secondaryBtn(acts, "Invoice", { icon: "receipt1-linear" });
primaryBtn(acts, "Book a ride", { h: 52, icon: "arrow-right-linear" });
homeIndicator(s);
return { screen: "activated", id: s.id, contentBottom: c.y + c.height };
