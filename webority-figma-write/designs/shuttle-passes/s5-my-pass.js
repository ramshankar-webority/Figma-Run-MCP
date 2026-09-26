const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "P5 · My pass", 4);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "My pass", "setting2-linear");
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 12 }); sizing(c, "FILL", "HUG");

// Rides left ring + validity
const top = card(c, "Balance", { dir: "HORIZONTAL", pad: 16, gap: 16, cross: "CENTER", r: 24, flat: true });
const rg = ring(top, 104, 31 / 44, C.p, C.p15, 11, "Rides left ring");
const rl = col(rg, "Label", { cross: "CENTER", gap: 0, w: 104 }); rl.x = 0; rl.y = 30;
t(rl, "31", { size: 28, weight: "bold", ls: -0.6, align: "CENTER" });
t(rl, "rides left", { size: 12, weight: "medium", color: C.t3 });
const tx = col(top, "Info", { gap: 6 }); tx.layoutGrow = 1;
t(tx, "Monthly Commuter", { size: 17, weight: "bold" });
t(tx, "Valid till 23-Oct  ·  22 days left", { size: 12, weight: "medium", color: C.t3 });
const bar = row(tx, "Days bar", { h: 6, r: 3, fills: solid(C.p15) }); sizing(bar, "FILL", "FIXED");
rect(bar, "Elapsed", 0, 0, 58, 6, solid(C.p), 3);
badge(tx, "On track: 4.3 rides a week", C.okA, C.ok10, { dot: true });

// Stats
const stt = row(c, "Stats", { gap: 10 }); fill(stt);
kpi(stt, "Used", "13 rides", "of 44", true, "tick-circle-linear");
kpi(stt, "Saved", "₹325", "vs single rides", true, "money-recive-linear");
kpi(stt, "Rollover", "0 rides", "carry up to 4", true, "flash-linear");

// Usage chart
const ch = card(c, "Usage", { pad: 16, gap: 12, r: 22, flat: true });
const chh = row(ch, "Head", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(chh);
t(chh, "Rides per week", { size: 15, weight: "bold" }); t(chh, "September", { size: 12, weight: "medium", color: C.t3 });
const bars = row(ch, "Bars", { gap: 14, cross: "MAX", h: 108 }); sizing(bars, "FILL", "FIXED");
[["W1", 4, false], ["W2", 5, false], ["W3", 4, true], ["W4", 0, false], ["W5", 0, false]].forEach(([w, n, cur]) => {
  const bc = col(bars, w, { gap: 6, cross: "CENTER", main: "MAX" }); sizing(bc, "FILL", "FILL");
  t(bc, n ? String(n) : "-", { size: 12, weight: "semibold", color: cur ? C.p : C.t3 });
  const b = rect(bc, "bar", 0, 0, 30, Math.max(6, n * 12), solid(n ? (cur ? C.p : C.p30) : C.p10), 8); sizing(b, "FILL", "FIXED");
  t(bc, w, { size: 12, weight: "medium", color: C.t3 });
});

// Auto-renew
const ar = card(c, "Auto-renew", { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", r: 20, flat: true });
iconTile(ar, "flash-linear", C.okA, C.ok10, 40, 13);
const ax = col(ar, "t", { gap: 2 }); ax.layoutGrow = 1;
t(ax, "Auto-renew", { size: 15, weight: "semibold" }); t(ax, "23-Oct  ·  about ₹1,247.40 by UPI", { size: 12, weight: "medium", color: C.t3 });
toggle(ar, true);

const bb = bottomBar(s, 124);
const acts = row(bb, "Actions", { gap: 10 }); fill(acts);
secondaryBtn(acts, "Upgrade", { icon: "crown1-linear" });
primaryBtn(acts, "Top up 10 rides", { h: 52, icon: "add-linear" });
const nt = t(bb, "Top up: ₹600 for 10 extra rides, same end date", { size: 12, weight: "medium", color: C.t3, align: "CENTER" }); sizing(nt, "FILL", "HUG");
homeIndicator(s);
return { screen: "my-pass", id: s.id, contentBottom: c.y + c.height, barTop: bb.y };
