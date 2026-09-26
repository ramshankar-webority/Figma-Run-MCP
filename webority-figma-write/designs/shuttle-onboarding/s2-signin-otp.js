const section = await figma.getNodeByIdAsync(SECTION_ID);

// Sign in
const s = screenAL(section, "O5 · Sign in", 4);
backdrop(s, 420);
statusBarAL(s);
const c = col(s, "Content", { pad: [20, 20, 0, 20], gap: 18 }); sizing(c, "FILL", "HUG");
const lg = row(c, "Logo", { w: 56, h: 56, r: 18, main: "CENTER", cross: "CENTER", fills: solid(C.p) }); icon(lg, "bus-bold", 0, 0, 28, C.white);
const hd = col(c, "Heading", { gap: 6 }); fill(hd);
t(hd, "Welcome to OfficeLoop", { size: 28, weight: "bold", ls: -0.6 });
t(hd, "Sign in with the phone number or work email your company registered.", { size: 15, weight: "medium", color: C.t2, w: 340, lh: 22 });
const seg = row(c, "Method", { pad: 4, gap: 4, r: 22, h: 46, cross: "CENTER", fills: solid(C.dbg) }); sizing(seg, "FILL", "FIXED");
[["mobile-linear", "Phone", true], ["sms-linear", "Work email", false]].forEach(([k, l, on]) => {
  const it = row(seg, "Segment/" + l, { gap: 8, main: "CENTER", cross: "CENTER", r: 18, fills: on ? solid(C.white) : [], stroke: on ? C.border : undefined });
  sizing(it, "FILL", "FILL"); icon(it, k, 0, 0, 18, on ? C.p : C.t3); t(it, l, { size: 14, weight: on ? "semibold" : "medium", color: on ? C.heading : C.t3 });
});
const fld = col(c, "Field", { gap: 8 }); fill(fld);
t(fld, "Mobile number", { size: 13, weight: "semibold", color: C.t2 });
const fr = row(fld, "Input", { gap: 10, cross: "CENTER" }); fill(fr);
const cc = row(fr, "Country", { pad: [0, 14], h: 54, r: 16, gap: 6, cross: "CENTER", fills: solid(C.white), stroke: C.border }); t(cc, "IN  +91", { size: 15, weight: "semibold" });
const ph = row(fr, "Number", { pad: [0, 16], h: 54, r: 16, cross: "CENTER", fills: solid(C.white), stroke: C.p }); ph.strokeWeight = 1.5; ph.layoutGrow = 1;
t(ph, "98450 12345", { size: 17, weight: "semibold", ls: 0.5 }); rect(ph, "Caret", 0, 0, 2, 22, solid(C.p), 1);
primaryBtn(c, "Send OTP", { icon: "arrow-right-linear", h: 54 });
const orr = row(c, "Or", { gap: 12, cross: "CENTER" }); fill(orr);
divider(orr); t(orr, "or", { size: 13, weight: "medium", color: C.t3 }); divider(orr);
secondaryBtn(c, "Continue with company SSO", { icon: "briefcase-linear", h: 54 });
secondaryBtn(c, "Continue with Google", { icon: "global-linear", h: 54 });
const terms = absolute(t(s, "By continuing you agree to the Terms and Privacy Policy.", { size: 12, weight: "medium", color: C.t3, align: "CENTER", w: 330 }), 30, 780);

// OTP
const o = screenAL(section, "O6 · Verify OTP", 5);
backdrop(o, 300);
statusBarAL(o);
navBar(o, "Verify", null, 2);
const oc = col(o, "Content", { pad: [8, 20, 0, 20], gap: 20 }); sizing(oc, "FILL", "HUG");
const oh = col(oc, "Heading", { gap: 6 }); fill(oh);
t(oh, "Enter the 6-digit code", { size: 26, weight: "bold", ls: -0.5 });
const sub = row(oh, "Sent to", { gap: 6, cross: "CENTER" });
t(sub, "Sent to +91 98450 12345", { size: 15, weight: "medium", color: C.t2 }); t(sub, "Edit", { size: 15, weight: "semibold", color: C.p });
const boxes = row(oc, "Code", { gap: 8, main: "SPACE_BETWEEN" }); fill(boxes);
["4", "8", "2", "9", "", ""].forEach((d, i) => {
  const focus = i === 4;
  const b = row(boxes, "Digit " + (i + 1), { w: 50, h: 58, r: 16, main: "CENTER", cross: "CENTER", fills: solid(C.white), stroke: focus ? C.p : d ? C.p30 : C.border });
  if (focus) b.strokeWeight = 1.5;
  if (d) t(b, d, { size: 24, weight: "bold" }); else if (focus) rect(b, "Caret", 0, 0, 2, 24, solid(C.p), 1);
});
const rs = row(oc, "Resend", { gap: 6, cross: "CENTER" });
icon(rs, "clock-linear", 0, 0, 16, C.t3); t(rs, "Resend code in 0:24", { size: 14, weight: "medium", color: C.t3 });
primaryBtn(oc, "Verify", { h: 54, icon: "tick-circle-linear" });
// Keypad
const kp = absolute(col(o, "Keypad", { pad: [12, 20, 34, 20], gap: 8, w: 390, fills: solid(C.dbg) }), 0, 598);
kp.topLeftRadius = 28; kp.topRightRadius = 28;
[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "del"]].forEach((r, ri) => {
  const kr = row(kp, "Keys " + (ri + 1), { gap: 8 }); fill(kr);
  r.forEach((k) => {
    const key = row(kr, "Key " + (k || "blank"), { h: 44, r: 12, main: "CENTER", cross: "CENTER", fills: k && k !== "del" ? solid(C.white) : [] }); sizing(key, "FILL", "FIXED");
    if (k === "del") icon(key, "arrow-left-linear", 0, 0, 22, C.heading); else if (k) t(key, k, { size: 22, weight: "semibold" });
  });
});
absolute(rect(o, "Home indicator", 0, 0, 134, 5, solid(C.heading), 3), 128, 831);
return { signin: s.id, signinBottom: c.y + c.height, otp: o.id, otpBottom: oc.y + oc.height, keypadTop: kp.y };
