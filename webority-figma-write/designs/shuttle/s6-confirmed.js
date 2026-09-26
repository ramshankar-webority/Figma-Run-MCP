const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "06 · Booking confirmed", 5);
absolute(rect(s, "Backdrop/wash", 0, 0, 390, 520, grad([[C.ok10, 1, 0], [C.bg, 1, 1]], "v")), 0, 0);
const b1 = absolute(ellipse(s, "Backdrop/blob", 0, 0, 300, 240, solid(C.ok, 0.2)), 45, 40); b1.effects = [blur(80)];
const b2 = absolute(ellipse(s, "Backdrop/blob 2", 0, 0, 260, 220, solid(C.p, 0.16)), 180, 260); b2.effects = [blur(80)];
statusBarAL(s);
const c = col(s, "Content", { pad: [10, 20, 0, 20], gap: 16, cross: "CENTER" }); sizing(c, "FILL", "HUG");

const ring = glassAL(c, "Success ring", "HORIZONTAL", { w: 92, h: 92, r: 46, main: "CENTER", cross: "CENTER", tint: 0.55, strong: true });
const inr = row(ring, "Tick", { w: 64, h: 64, r: 32, main: "CENTER", cross: "CENTER", fills: solid(C.ok), effects: [shadow(C.ok, 0.4, 8, 18)] });
icon(inr, "tick-circle-bold", 0, 0, 34, C.white);
const ht = col(c, "Headline", { gap: 4, cross: "CENTER" });
t(ht, "Seat booked!", { size: 28, weight: "bold", ls: -0.6 });
t(ht, "We will remind you 15 min before pickup.", { size: 14, weight: "medium", color: C.t2 });

// Boarding pass
const pass = col(c, "Boarding pass", { r: 28, fills: solid(C.white), effects: [shadow(C.heading, 0.1, 16, 40)], clip: true }); fill(pass);
const top = col(pass, "Top", { pad: [18, 20, 16, 20], gap: 14 }); fill(top);
const pr = row(top, "Route row", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(pr);
const a = col(pr, "From", { gap: 2 }); t(a, "8:05 AM", { size: 22, weight: "bold" }); t(a, "Indiranagar", { size: 13, weight: "medium", color: C.t3 });
const mid = col(pr, "Mid", { gap: 4, cross: "CENTER" });
const busT = row(mid, "Bus", { w: 34, h: 34, r: 17, main: "CENTER", cross: "CENTER", fills: solid(C.p10) }); icon(busT, "bus-bold", 0, 0, 18, C.p);
t(mid, "1 h 05 min", { size: 11, weight: "semibold", color: C.t4 });
const b = col(pr, "To", { gap: 2, cross: "MAX" }); t(b, "9:10 AM", { size: 22, weight: "bold" }); t(b, "Whitefield", { size: 13, weight: "medium", color: C.t3 });
const dg = row(top, "Details", { main: "SPACE_BETWEEN" }); fill(dg);
[["DATE", "24-Sep"], ["SEAT", "7A"], ["ROUTE", "R-12"], ["VEHICLE", "AB 4521"]].forEach(([l, v]) => { const cc = col(dg, l, { gap: 2 }); t(cc, l, { size: 10, weight: "semibold", color: C.t4, ls: 0.8 }); t(cc, v, { size: 15, weight: "bold" }); });
// Perforation with notches
const perf = row(pass, "Perforation", { h: 24, cross: "CENTER" }); sizing(perf, "FILL", "FIXED");
absolute(ellipse(perf, "Notch L", 0, 0, 24, 24, solid(C.bg)), -12, 0);
absolute(ellipse(perf, "Notch R", 0, 0, 24, 24, solid(C.bg)), 338, 0);
const dash = absolute(line(perf, "Dash", 0, 0, 290, 0, C.t5, 1.5, [6, 6]), 30, 12);
const bot = row(pass, "Bottom", { pad: [8, 20, 20, 20], gap: 16, cross: "CENTER" }); fill(bot);
const q = qr(bot, 116);
const bi = col(bot, "Booking", { gap: 6 }); bi.layoutGrow = 1;
t(bi, "BOOKING ID", { size: 10, weight: "semibold", color: C.t4, ls: 0.8 });
t(bi, "OLP-2409-7A31", { size: 16, weight: "bold" });
t(bi, "Show this QR to the driver while boarding.", { size: 12, weight: "medium", color: C.t3, w: 170 });

const acts = row(c, "Actions", { gap: 10 }); fill(acts);
const w = glassAL(acts, "Add to Wallet", "HORIZONTAL", { button: true, h: 54, r: 27, gap: 8, main: "CENTER", cross: "CENTER", tint: 0.7 }); sizing(w, "FILL", "FIXED");
icon(w, "wallet-linear", 0, 0, 20, C.heading); t(w, "Add to Wallet", { size: 15, weight: "semibold" });
const tr = primaryBtn(acts, "Track shuttle", { h: 54, icon: "gps-linear" });
const more = card(c, "Next steps", { pad: [6, 16], gap: 0, r: 22, flat: true });
[["calendar-tick-linear", C.p, C.p10, "Add to calendar", "Thu, 24-Sep-2026  ·  8:05 AM"], ["people-linear", C.info, C.info10, "Share trip with team", "Colleagues on R-12 can join your seat row"]].forEach(([k, fg, bg, l, sb], i) => {
  if (i) divider(more);
  const r = row(more, l, { pad: [12, 0], gap: 12, cross: "CENTER" }); fill(r);
  iconTile(r, k, fg, bg, 40, 13);
  const tx = col(r, "t", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, l, { size: 15, weight: "semibold" }); t(tx, sb, { size: 12, weight: "medium", color: C.t3 });
  icon(r, "arrow-right-linear", 0, 0, 18, C.t4);
});
homeIndicator(s);
return "confirmed";
