// Flat look: remove every drop and inner shadow in the section (Liquid Glass and blurs stay).
const sec = await figma.getNodeByIdAsync(SECTION_ID);
let n = 0;
for (const node of sec.findAll((x) => "effects" in x && x.effects.length)) {
  const keep = node.effects.filter((e) => e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW");
  if (keep.length !== node.effects.length) { node.effects = keep; n++; }
}
// Exceptions: light soft shadow on the switch knob and the bottom nav (tab) bar.
const lite = (a, y, r) => ({ type: "DROP_SHADOW", color: { r: 7 / 255, g: 20 / 255, b: 55 / 255, a }, offset: { x: 0, y }, radius: r, spread: 0, visible: true, blendMode: "NORMAL" });
let kept = 0;
for (const node of sec.findAll((x) => x.name === "knob" || x.name === "Tab bar (Liquid Glass)")) {
  node.effects = node.name === "knob" ? [lite(0.15, 2, 4), ...node.effects] : [lite(0.06, 6, 20), ...node.effects];
  kept++;
}
return { stripped: n, softShadows: kept };
