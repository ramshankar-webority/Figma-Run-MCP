const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "P6 · Pass revenue (operator)", 5);
backdrop(s, 300);
statusBarAL(s);
const c = col(s, "Content", { pad: [4, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");

const h = row(c, "Header", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(h);
const hx = col(h, "t", { gap: 2 });
t(hx, "Operator view", { size: 12, weight: "semibold", color: C.p });
t(hx, "Pass revenue", { size: 28, weight: "bold", ls: -0.8 });
glassBtn(h, "Export", 44, "export-linear");
const ch = row(c, "Period", { gap: 8 });
chip(ch, "Sep 2026", true); chip(ch, "Aug", false); chip(ch, "Quarter", false); chip(ch, "Year", false);

// KPIs 2 x 2
const g1 = row(c, "KPI row 1", { gap: 10 }); fill(g1);
kpi(g1, "Revenue", "₹18,42,600", "+14.2% vs Aug", true, "money-recive-linear");
kpi(g1, "Active passes", "1,284", "+96 this month", true, "ticket-discount-linear");
const g2 = row(c, "KPI row 2", { gap: 10 }); fill(g2);
kpi(g2, "Rides used", "38,410", "81% of pass rides", true, "bus-linear");
kpi(g2, "Renewal rate", "72%", "+4 pts vs Aug", true, "trend-up-linear");

// Weekly revenue chart
const rc = card(c, "Revenue chart", { pad: 16, gap: 10, r: 22, flat: true });
const rh = row(rc, "Head", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(rh);
t(rh, "Revenue by week", { size: 15, weight: "bold" }); t(rh, "₹ lakh", { size: 12, weight: "medium", color: C.t3 });
const bars = row(rc, "Bars", { gap: 14, cross: "MAX", h: 104 }); sizing(bars, "FILL", "FIXED");
[["W1", 3.9], ["W2", 4.4], ["W3", 4.1], ["W4", 5.0], ["W5", 1.0]].forEach(([w, v], i) => {
  const cur = i === 3;
  const bc = col(bars, w, { gap: 6, cross: "CENTER", main: "MAX" }); sizing(bc, "FILL", "FILL");
  t(bc, v.toFixed(1), { size: 12, weight: "semibold", color: cur ? C.p : C.t3 });
  const b = rect(bc, "bar", 0, 0, 30, Math.round(v * 11), solid(cur ? C.p : C.p30), 8); sizing(b, "FILL", "FIXED");
  t(bc, w, { size: 12, weight: "medium", color: C.t3 });
});

// Plan mix
const mx = card(c, "Plan mix", { pad: 16, gap: 11, r: 22, flat: true });
t(mx, "Revenue by pass", { size: 15, weight: "bold" });
[["Monthly Commuter", "₹11,08,800", 0.60, C.p], ["Quarterly Pro", "₹4,35,600", 0.24, C.info], ["Flexi 20", "₹2,01,600", 0.11, C.ok], ["Weekly Saver", "₹96,600", 0.05, C.warn]].forEach(([n, v, f, col2]) => {
  const r = col(mx, n, { gap: 5 }); fill(r);
  const lr = row(r, "l", { main: "SPACE_BETWEEN" }); fill(lr);
  t(lr, n, { size: 13, weight: "semibold" }); t(lr, v + "  ·  " + Math.round(f * 100) + "%", { size: 12, weight: "medium", color: C.t2 });
  const tr = row(r, "Track", { h: 6, r: 3, fills: solid(C.dbg) }); sizing(tr, "FILL", "FIXED");
  rect(tr, "Share", 0, 0, Math.round(318 * f), 6, solid(col2), 3);
});
homeIndicator(s);
return { screen: "revenue", id: s.id, contentBottom: c.y + c.height };
