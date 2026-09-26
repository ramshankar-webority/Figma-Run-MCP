// Create the section to the right of existing content on the current page.
const page = figma.currentPage;
let maxX = 0;
for (const n of page.children) if ("x" in n && n.x + n.width > maxX) maxX = n.x + n.width;
const section = figma.createSection();
section.name = "Pulse · Music Player App";
page.appendChild(section);
section.x = Math.round(maxX + 400);
section.y = 0;
section.resizeWithoutConstraints(80 + 4 * 470, 140 + 844 + 100);
section.fills = solid("#050508");
text(section, "Pulse", 80, 40, { size: 40, style: "Bold" });
text(section, "Music player · 4 screens · Dark theme", 80, 92, { size: 16, color: C.muted });
return { sectionId: section.id };
