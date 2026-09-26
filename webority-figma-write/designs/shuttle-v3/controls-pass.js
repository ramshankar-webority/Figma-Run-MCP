// OfficeLoop V3, second pass on a V3 section (prepend: const SECTION = "<id>";).
// Small controls grow to a 44 px hit area; white status text on see-through pills gets a solid pill.
const sec = await figma.getNodeByIdAsync(SECTION);
const out = { grown: [], pills: [] };
// Controls under 44 px: grow the frame itself (auto layout re-centres the content).
for (const n of sec.findAll((x) => (x.type === "FRAME" || x.type === "INSTANCE") && /^(Prev week|Next week|Chip\/)/.test(x.name))) {
  if (n.width >= 44 && n.height >= 44) continue;
  if (n.name.startsWith("Chip/")) { n.minHeight = 44; n.counterAxisAlignItems = "CENTER"; }
  else { n.resize(Math.max(44, n.width), Math.max(44, n.height)); n.cornerRadius = 22; }
  out.grown.push(n.name);
}
// Status pills on the pass gradient: 18% white let the gradient through; a solid deep blue passes with white text.
for (const n of sec.findAll((x) => x.type === "FRAME" && /^(Popular|Active)$/.test(x.name))) {
  n.fills = [{ type: "SOLID", color: { r: 0x10 / 255, g: 0x2a / 255, b: 0xa8 / 255 }, opacity: 1 }];
  out.pills.push(n.name);
}
return out;
