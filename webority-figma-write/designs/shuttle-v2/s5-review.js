const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "05 · Review & confirm", 4);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Review booking", null, 4);
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");

// Trip card
const trip = card(c, "Trip", { pad: 16, gap: 14, r: 24, flat: true });
const th = row(trip, "Head", { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(th);
const tl = col(th, "t", { gap: 2 });
t(tl, "Thu, 24-Sep-2026", { size: 17, weight: "bold" });
t(tl, "Login shift  ·  Route R-12", { size: 13, weight: "medium", color: C.t3 });
badge(th, "To office", C.p, C.p10, { icon: "buildings2-bold" });
divider(trip);
const tlb = row(trip, "Timeline", { gap: 12 }); fill(tlb);
const rail = col(tlb, "Rail", { gap: 4, cross: "CENTER", pad: [4, 0] }); sizing(rail, "HUG", "FILL");
const d1 = ellipse(rail, "Start", 0, 0, 12, 12, solid(C.white)); d1.strokes = solid(C.p); d1.strokeWeight = 3;
const ln = rect(rail, "Line", 0, 0, 2, 20, solid(C.p30), 1); ln.layoutGrow = 1;
ellipse(rail, "End", 0, 0, 12, 12, solid(C.p));
const stops = col(tlb, "Stops", { gap: 20 }); stops.layoutGrow = 1;
[["8:05 AM", "Indiranagar Metro Gate 2", "Pickup  ·  4 min walk from home"], ["9:10 AM", "Nexa Tech Park, Tower B", "Drop  ·  Whitefield Main Road"]].forEach(([tm, nm, sb]) => {
  const r = row(stops, nm, { main: "SPACE_BETWEEN" }); fill(r);
  const tx = col(r, "t", { gap: 2 }); tx.layoutGrow = 1;
  t(tx, nm, { size: 15, weight: "semibold" }); t(tx, sb, { size: 12, weight: "medium", color: C.t3 });
  t(r, tm, { size: 15, weight: "bold", color: C.p });
});
const office = frame(trip, "Office photo", 0, 0, 318, 72, imgFill(img("19821492")), 16); fill(office);
rect(office, "Scrim", 0, 0, 318, 72, grad([["#071437", 0.65, 0], ["#071437", 0, 0.8]], "h"));
const ot = col(office, "t", { gap: 2 }); ot.x = 14; ot.y = 16;
t(ot, "Journey  ·  1 h 05 min", { size: 15, weight: "bold", color: C.white });
t(ot, "18.4 km via Old Airport Road", { size: 12, weight: "medium", color: "#DDE3F5" });

// Details grid: V2 labels are 12 px sentence case, not 11 px caps.
const grid = card(c, "Details", { dir: "HORIZONTAL", pad: [14, 8], gap: 0, r: 22, flat: true });
[["Seat", "7A", "Window"], ["Vehicle", "KA 03", "AB 4521"], ["Return", "6:30 PM", "Booked"]].forEach(([l, v, sb], i) => {
  const cc = col(grid, l, { gap: 2, cross: "CENTER" }); sizing(cc, "FILL", "HUG");
  t(cc, l, { size: 12, weight: "medium", color: C.t3 });
  t(cc, v, { size: 17, weight: "bold" });
  t(cc, sb, { size: 12, weight: "medium", color: i === 2 ? C.okA : C.t3 });
});

// Fare
const fare = card(c, "Fare", { pad: 16, gap: 10, r: 22, flat: true });
const fr = (l, v, o = {}) => { const r = row(fare, l, { main: "SPACE_BETWEEN", cross: "CENTER" }); fill(r); t(r, l, { size: 14, weight: o.b ? "bold" : "medium", color: o.b ? C.heading : C.t2 }); t(r, v, { size: o.b ? 18 : 14, weight: o.b ? "bold" : "semibold", color: o.c || C.heading }); };
fr("Ride fare", "₹85.00");
fr("Company subsidy", "-₹85.00", { c: C.okA });
divider(fare);
fr("You pay", "₹0.00", { b: true });
const pay = row(fare, "Billing", { pad: [10, 12], gap: 10, r: 14, cross: "CENTER", fills: solid(C.p5) }); fill(pay);
icon(pay, "wallet-check-linear", 0, 0, 20, C.p);
const pt = t(pay, "Billed to Nexa corporate commute plan", { size: 13, weight: "medium", color: C.t1 }); pt.layoutGrow = 1;
icon(pay, "shield-tick-bold", 0, 0, 18, C.ok);

const bb = bottomBar(s, 124);
primaryBtn(bb, "Confirm booking", { icon: "tick-circle-linear", h: 52 });
const note = t(bb, "Free cancellation until 7:15 AM on Thursday", { size: 12, weight: "medium", color: C.t3, align: "CENTER" }); sizing(note, "FILL", "HUG");
homeIndicator(s);
return { screen: "review", contentBottom: c.y + c.height, barTop: bb.y };
