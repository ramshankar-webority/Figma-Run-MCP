// Placed below the lowest section on the page, so V1, V2 and the compare list stay above it.
let maxY = 0;
for (const n of figma.currentPage.children) if ("y" in n && n.y + n.height > maxY) maxY = n.y + n.height;
const section = flowSection("OfficeLoop V2 · Passes & subscription", "OfficeLoop Passes", "Explore passes, buy one, track rides left and used, and the operator's revenue view. Prices in ₹, single ride ₹85.", ["Explore passes", "Pass details", "Checkout", "Pass activated", "My pass", "Pass revenue (operator)"], Math.round(maxY + 200));
return { sectionId: section.id };
