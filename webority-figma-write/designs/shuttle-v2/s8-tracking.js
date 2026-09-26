// V2: same live map; info tile labels raised to 12 px and tiles tightened.
const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "08 · Live tracking", 7);
const mapF = absolute(cityMap(s, "Live map", 390, 844), 0, 0);
path(mapF, "Route done", "M 60 760 C 90 640 70 560 120 470 C 170 380 200 360 180 300", C.p, 6, { opacity: 0.35 });
path(mapF, "Route ahead", "M 180 300 C 170 240 240 200 260 150 C 280 100 320 90 340 40", C.p, 6);
dotPin(mapF, 120, 470, C.t4, 5);
ellipse(mapF, "Shuttle halo", 140, 260, 80, 80, solid(C.p, 0.12));
const sh = frame(mapF, "Shuttle marker", 158, 278, 44, 44, solid(C.p), 22); sh.clipsContent = false;
sh.strokes = solid(C.white); sh.strokeWeight = 3; sh.strokeAlign = "OUTSIDE"; sh.effects = [shadow(C.p, 0.45, 6, 16)];
icon(sh, "bus-bold", 11, 11, 22, C.white);
pin(mapF, 260, 150, C.ok, "location-bold", 40);
const you = ellipse(mapF, "You", 262, 184, 16, 16, solid(C.info)); you.strokes = solid(C.white); you.strokeWeight = 3;

statusBarAL(s);
const top = row(s, "Top", { pad: [6, 20, 0, 20], main: "SPACE_BETWEEN", cross: "CENTER" }); sizing(top, "FILL", "HUG");
glassBtn(top, "Back", 44, "arrow-left-linear");
const eta = glassAL(top, "ETA pill", "HORIZONTAL", { pad: [10, 16], gap: 8, r: 22, cross: "CENTER", tint: 0.7, strong: true });
ellipse(eta, "live", 0, 0, 8, 8, solid(C.ok));
t(eta, "Arriving in 6 min", { size: 15, weight: "semibold" });
glassBtn(top, "Share", 44, "export-linear");
const bub = absolute(glassAL(s, "Stop bubble", "HORIZONTAL", { pad: [7, 12], gap: 6, r: 16, cross: "CENTER", tint: 0.8 }), 190, 206);
icon(bub, "location-linear", 0, 0, 14, C.ok); t(bub, "Your stop  ·  8:05 AM", { size: 12, weight: "semibold" });

// Bottom sheet
const sheet = absolute(glassAL(s, "Ride sheet (Liquid Glass)", "VERTICAL", { pad: [10, 20, 34, 20], gap: 14, r: 40, w: 390, strong: true, tint: 0.78, cross: "CENTER" }), 0, 468);
sheet.bottomLeftRadius = 48; sheet.bottomRightRadius = 48;
rect(sheet, "Grabber", 0, 0, 40, 5, solid(C.t5), 3);
const dr = row(sheet, "Driver", { gap: 12, cross: "CENTER" }); fill(dr);
const ph = ellipse(dr, "Driver photo", 0, 0, 54, 54, imgFill(img("30767572"))); ph.strokes = solid(C.white); ph.strokeWeight = 2.5;
const dt = col(dr, "t", { gap: 2 }); dt.layoutGrow = 1;
t(dt, "Ravi Kumar", { size: 17, weight: "bold" });
const rr = row(dt, "Rating", { gap: 4, cross: "CENTER" }); icon(rr, "star1-bold", 0, 0, 14, C.warn); t(rr, "4.9  ·  2,140 rides", { size: 12, weight: "medium", color: C.t3 });
const pl = col(dr, "Plate", { pad: [6, 10], r: 10, cross: "CENTER", fills: solid(C.white), stroke: C.border }); t(pl, "KA 03", { size: 11, weight: "semibold", color: C.t3 }); t(pl, "AB 4521", { size: 14, weight: "bold" });
// Progress
const prog = col(sheet, "Progress", { gap: 8 }); fill(prog);
const pr = row(prog, "Labels", { main: "SPACE_BETWEEN" }); fill(pr);
t(pr, "Now at Domlur Flyover", { size: 12, weight: "medium", color: C.t3 }); t(pr, "2 stops to you", { size: 12, weight: "semibold", color: C.p });
const bar = row(prog, "Bar", { h: 8, r: 4, fills: solid(C.p15) }); sizing(bar, "FILL", "FIXED");
rect(bar, "Done", 0, 0, 220, 8, grad([[C.p50, 1, 0], [C.p, 1, 1]], "h"), 4);
// Info tiles
const tiles = row(sheet, "Tiles", { gap: 10 }); fill(tiles);
[["clock-linear", "Pickup", "8:05 AM"], ["user-linear", "Seat", "7A"], ["people-linear", "On board", "14 / 26"]].forEach(([k, l, v]) => {
  const tl = col(tiles, l, { pad: 12, gap: 4, r: 18, fills: solid(C.white, 0.9), stroke: C.border }); sizing(tl, "FILL", "HUG");
  icon(tl, k, 0, 0, 18, C.p); t(tl, l, { size: 12, weight: "medium", color: C.t3 }); t(tl, v, { size: 15, weight: "bold" });
});
const acts = row(sheet, "Actions", { gap: 10, cross: "CENTER" }); fill(acts);
glassBtn(acts, "Call driver", 54, "call-linear", C.ok, { tint: 0.8 });
glassBtn(acts, "Message driver", 54, "message-linear", C.p, { tint: 0.8 });
primaryBtn(acts, "Boarding pass", { h: 54, icon: "scan-barcode-linear" });
homeIndicator(s);
sheet.y = 844 - sheet.height;
return { screen: "tracking" };
