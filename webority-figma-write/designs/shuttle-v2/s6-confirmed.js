const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "06 · Booking confirmed", 5);
absolute(rect(s, "Backdrop/wash", 0, 0, 390, 520, grad([[C.ok10, 1, 0], [C.bg, 1, 1]], "v")), 0, 0);
const b1 = absolute(ellipse(s, "Backdrop/blob", 0, 0, 300, 240, solid(C.ok, 0.2)), 45, 40); b1.effects = [blur(80)];
const b2 = absolute(ellipse(s, "Backdrop/blob 2", 0, 0, 260, 220, solid(C.p, 0.16)), 180, 260); b2.effects = [blur(80)];
statusBarAL(s);
const c = col(s, "Content", { pad: [10, 20, 0, 20], gap: 16, cross: "CENTER" }); sizing(c, "FILL", "HUG");

const ring = glassAL(c, "Success ring", "HORIZONTAL", { w: 88, h: 88, r: 44, main: "CENTER", cross: "CENTER", tint: 0.55, strong: true });
const inr = row(ring, "Tick", { w: 62, h: 62, r: 31, main: "CENTER", cross: "CENTER", fills: solid(C.ok) });
icon(inr, "tick-circle-bold", 0, 0, 34, C.white);
const ht = col(c, "Headline", { gap: 4, cross: "CENTER" });
t(ht, "Seat booked!", { size: 28, weight: "bold", ls: -0.6 });
t(ht, "We will remind you 15 min before pickup.", { size: 14, weight: "medium", color: C.t2 });

// Boarding pass: hairline border instead of a heavy shadow, 12 px sentence-case labels.
const pass = col(c, "Boarding pass", { r: 28, fills: solid(C.white), stroke: C.border, clip: true }); fill(pass);
const top = col(pass, "Top", { pad: [18, 20, 16, 20], gap: 14 }); fill(top);
const pr = row(top, "Route row", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(pr);
const a = col(pr, "From", { gap: 2 }); t(a, "8:05 AM", { size: 22, weight: "bold" }); t(a, "Indiranagar", { size: 13, weight: "medium", color: C.t3 });
const mid = col(pr, "Mid", { gap: 4, cross: "CENTER" });
const busT = row(mid, "Bus", { w: 34, h: 34, r: 17, main: "CENTER", cross: "CENTER", fills: solid(C.p10) }); icon(busT, "bus-bold", 0, 0, 18, C.p);
t(mid, "1 h 05 min", { size: 12, weight: "semibold", color: C.t3 });
const b = col(pr, "To", { gap: 2, cross: "MAX" }); t(b, "9:10 AM", { size: 22, weight: "bold" }); t(b, "Whitefield", { size: 13, weight: "medium", color: C.t3 });
const dg = row(top, "Details", { main: "SPACE_BETWEEN" }); fill(dg);
[["Date", "24-Sep"], ["Seat", "7A"], ["Route", "R-12"], ["Vehicle", "AB 4521"]].forEach(([l, v]) => { const cc = col(dg, l, { gap: 2 }); t(cc, l, { size: 12, weight: "medium", color: C.t3 }); t(cc, v, { size: 15, weight: "bold" }); });
const perf = row(pass, "Perforation", { h: 24, cross: "CENTER" }); sizing(perf, "FILL", "FIXED");
absolute(ellipse(perf, "Notch L", 0, 0, 24, 24, solid(C.bg)), -12, 0);
absolute(ellipse(perf, "Notch R", 0, 0, 24, 24, solid(C.bg)), 338, 0);
absolute(line(perf, "Dash", 0, 0, 290, 0, C.t5, 1.5, [6, 6]), 30, 12);
const bot = row(pass, "Bottom", { pad: [8, 20, 20, 20], gap: 16, cross: "CENTER" }); fill(bot);
qr(bot, 112);
const bi = col(bot, "Booking", { gap: 6 }); bi.layoutGrow = 1;
t(bi, "Booking ID", { size: 12, weight: "medium", color: C.t3 });
t(bi, "OLP-2409-7A31", { size: 16, weight: "bold" });
t(bi, "Show this QR to the driver while boarding.", { size: 12, weight: "medium", color: C.t3, w: 170 });

// One primary action (Track shuttle); Wallet is secondary.
const acts = row(c, "Actions", { gap: 10 }); fill(acts);
const w = row(acts, "Add to Wallet", { h: 52, r: 26, gap: 8, main: "CENTER", cross: "CENTER", fills: solid(C.white), stroke: C.border }); sizing(w, "FILL", "FIXED");
icon(w, "wallet-linear", 0, 0, 20, C.heading); t(w, "Add to Wallet", { size: 15, weight: "semibold" });
primaryBtn(acts, "Track shuttle", { h: 52, icon: "gps-linear" });
const more = card(c, "Next steps", { pad: [4, 16], gap: 0, r: 22, flat: true });
[["calendar-tick-linear", C.p, C.p10, "Add to calendar", "Thu, 24-Sep-2026  ·  8:05 AM"], ["people-linear", C.info, C.info10, "Share trip with team", "Colleagues on R-12 can join your seat row"]].forEach(([k, fg, bg, l, sb], i) => {
  if (i) divider(more);
  const r = row(more, l, { pad: [11, 0], gap: 12, cross: "CENTER" }); fill(r);
  iconTile(r, k, fg, bg, 40, 13);
  const tx = col(r, "t", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, l, { size: 15, weight: "semibold" }); t(tx, sb, { size: 12, weight: "medium", color: C.t3 });
  icon(r, "arrow-right-linear", 0, 0, 18, C.t3);
});
homeIndicator(s);
return { screen: "confirmed", contentBottom: c.y + c.height };
