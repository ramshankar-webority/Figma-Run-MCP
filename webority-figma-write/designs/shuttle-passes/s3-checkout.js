const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "P3 · Checkout", 2);
backdrop(s, 300);
statusBarAL(s);
navBar(s, "Checkout", null);
const c = col(s, "Content", { pad: [2, 20, 0, 20], gap: 14 }); sizing(c, "FILL", "HUG");

// Order
const od = card(c, "Order", { dir: "HORIZONTAL", pad: 14, gap: 12, cross: "CENTER", r: 20, flat: true });
iconTile(od, "ticket-discount-linear", C.white, C.p, 42, 13);
const ox = col(od, "t", { gap: 2 }); ox.layoutGrow = 1;
t(ox, "Monthly Commuter", { size: 15, weight: "bold" });
t(ox, "24-Sep to 23-Oct  ·  44 rides", { size: 12, weight: "medium", color: C.t3 });
t(od, "₹2,640", { size: 15, weight: "bold" });

// Price breakdown
const pb = card(c, "Price", { pad: 16, gap: 10, r: 22, flat: true });
const line2 = (l, v, o = {}) => { const r = row(pb, l, { main: "SPACE_BETWEEN", cross: "CENTER", gap: 8 }); fill(r); const lt = row(r, "l", { gap: 6, cross: "CENTER" }); if (o.icon) icon(lt, o.icon, 0, 0, 16, o.c || C.t2); t(lt, l, { size: 14, weight: o.b ? "bold" : "medium", color: o.b ? C.heading : C.t2 }); t(r, v, { size: o.b ? 20 : 14, weight: o.b ? "bold" : "semibold", color: o.c || C.heading }); };
line2("Pass price", "₹2,640.00");
line2("Promo OFFICE10", "-₹264.00", { c: C.okA, icon: "discount-shape-linear" });
line2("Nexa subsidy (50%)", "-₹1,188.00", { c: C.okA, icon: "briefcase-linear" });
line2("GST (5%)", "₹59.40");
divider(pb);
line2("You pay", "₹1,247.40", { b: true });

// Payment method
const pm = col(c, "Payment", { gap: 10 }); fill(pm);
sectionHead(pm, "Pay with");
const pl = card(pm, "Methods", { pad: [4, 16], gap: 0, r: 22, flat: true });
[["wallet-linear", "UPI", "ananya@okhdfc", true], ["card-linear", "Credit or debit card", "HDFC Bank  ·  •••• 4821", false], ["briefcase-linear", "Company wallet", "Balance ₹2,000.00", false]].forEach(([k, a, b, on], i) => {
  if (i) divider(pl, C.lborder);
  const r = row(pl, a, { pad: [11, 0], gap: 12, cross: "CENTER" }); fill(r);
  iconTile(r, k, on ? C.p : C.t2, on ? C.p10 : C.dbg, 38, 12);
  const tx = col(r, "t", { gap: 1 }); tx.layoutGrow = 1;
  t(tx, a, { size: 15, weight: "semibold" }); t(tx, b, { size: 12, weight: "medium", color: C.t3 });
  radio(r, on);
});

const bb = bottomBar(s, 124);
primaryBtn(bb, "Pay ₹1,247.40", { icon: "lock-linear", h: 52 });
const nt = row(bb, "Secure", { gap: 6, main: "CENTER", cross: "CENTER" }); fill(nt);
icon(nt, "shield-security-linear", 0, 0, 14, C.okA); t(nt, "Secure payment  ·  Invoice goes to your work email", { size: 12, weight: "medium", color: C.t3 });
homeIndicator(s);
return { screen: "checkout", id: s.id, contentBottom: c.y + c.height, barTop: bb.y };
