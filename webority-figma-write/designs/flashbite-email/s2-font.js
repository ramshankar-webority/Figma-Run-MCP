// Restyle every text node in the email to Bricolage Grotesque, keeping the weight intent.
const MAP = {
  "ExtraBold": "ExtraBold", "Extra Bold": "ExtraBold",
  "Bold": "Bold",
  "SemiBold": "SemiBold", "Semi Bold": "SemiBold",
  "Medium": "Medium",
  "Regular": "Regular"
};
const FAM = "Bricolage Grotesque";
const avail = (await figma.listAvailableFontsAsync())
  .filter(f => f.fontName.family === FAM)
  .map(f => f.fontName.style);
if (!avail.length) throw new Error("Bricolage Grotesque is not installed on this machine.");

const wanted = [...new Set(Object.values(MAP))].filter(s => avail.includes(s));
for (const style of wanted) await figma.loadFontAsync({ family: FAM, style });

const root = await figma.getNodeByIdAsync("4401:2");
if (!root) throw new Error("Root frame 4401:2 not found.");
const texts = root.findAllWithCriteria({ types: ["TEXT"] });

let changed = 0; const skipped = [];
for (const t of texts) {
  if (t.fontName === figma.mixed) { skipped.push(t.name + " (mixed fonts)"); continue; }
  const target = MAP[t.fontName.style] || "Regular";
  if (!avail.includes(target)) { skipped.push(t.name + " (no style " + target + ")"); continue; }
  await figma.loadFontAsync({ family: FAM, style: target });
  t.fontName = { family: FAM, style: target };
  changed++;
}
return { available: avail, textNodes: texts.length, changed, skipped };
