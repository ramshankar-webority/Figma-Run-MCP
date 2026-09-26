const page = figma.currentPage;
let maxX = 0;
for (const n of page.children) if ("x" in n && n.x + n.width > maxX) maxX = n.x + n.width;
const section = figma.createSection();
section.name = "OfficeLoop · Shuttle booking flow · Light · Liquid Glass";
page.appendChild(section);
section.x = Math.round(maxX + 400); section.y = 0;
section.resizeWithoutConstraints(80 + 8 * 470, 200 + 844 + 120);
section.fills = solid("#EEF1F6");
text(section, "OfficeLoop", 80, 44, { size: 44, weight: "bold", ls: -1.2 });
text(section, "Office commute shuttle booking  ·  iOS Liquid Glass  ·  Light mode  ·  Zalando Sans  ·  Iconsax  ·  Photos: Pexels", 80, 100, { size: 16, color: C.t2, weight: "medium" });
["Home", "Pickup stop", "Date & shift", "Seat selection", "Review & confirm", "Booking confirmed", "My rides", "Live tracking"].forEach((l, i) => {
  const g = row(section, "Label/" + l, { gap: 10, cross: "CENTER" }); g.x = 80 + i * 470; g.y = 150;
  const n = row(g, "num", { w: 28, h: 28, r: 14, main: "CENTER", cross: "CENTER", fills: solid(C.p) });
  t(n, String(i + 1), { size: 13, weight: "bold", color: C.white });
  t(g, l, { size: 16, weight: "semibold", color: C.heading });
});
return { sectionId: section.id };
