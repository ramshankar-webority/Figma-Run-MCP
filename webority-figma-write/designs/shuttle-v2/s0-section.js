const page = figma.currentPage;
let maxX = 0, v1Y = 0;
for (const n of page.children) if ("x" in n && n.x + n.width > maxX) maxX = n.x + n.width;
if (V1) { v1Y = V1.y + V1.height; }
const section = figma.createSection();
section.name = "OfficeLoop V2 · Shuttle booking flow · Light · Liquid Glass";
page.appendChild(section);
// Directly below V1 so the two versions compare screen by screen.
if (V1) { section.x = V1.x; section.y = Math.round(v1Y + 200); } else { section.x = Math.round(maxX + 400); section.y = 0; }
section.resizeWithoutConstraints(80 + 8 * 470, 200 + 844 + 120);
section.fills = solid("#EEF1F6");
const title = row(section, "Title", { gap: 12, cross: "CENTER" }); title.x = 80; title.y = 44;
t(title, "OfficeLoop", { size: 44, weight: "bold", ls: -1.2 });
const v = row(title, "Version", { pad: [6, 14], r: 16, cross: "CENTER", fills: solid(C.p) }); t(v, "V2", { size: 20, weight: "bold", color: C.white });
text(section, "Refined layout: step bar in the header, one section-title style, a summary above every action, one primary action per screen, no text below 12 px.", 80, 106, { size: 16, color: C.t2, weight: "medium" });
["Home", "Pickup stop", "Date & shift", "Seat selection", "Review & confirm", "Booking confirmed", "My rides", "Live tracking"].forEach((l, i) => {
  const g = row(section, "Label/" + l, { gap: 10, cross: "CENTER" }); g.x = 80 + i * 470; g.y = 150;
  const n = row(g, "num", { w: 28, h: 28, r: 14, main: "CENTER", cross: "CENTER", fills: solid(C.p) });
  t(n, String(i + 1), { size: 13, weight: "bold", color: C.white });
  t(g, l, { size: 16, weight: "semibold", color: C.heading });
});
return { sectionId: section.id };
