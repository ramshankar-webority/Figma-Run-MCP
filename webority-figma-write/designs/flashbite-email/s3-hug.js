// Horizontal auto-layout frames were left FIXED on the counter (vertical) axis, so they held the
// default 100px height and clipped their children. Make them hug, except the fixed-size dots.
const root = await figma.getNodeByIdAsync("4401:2");
if (!root) throw new Error("Root frame 4401:2 not found.");
const frames = root.findAllWithCriteria({ types: ["FRAME"] });
const fixed = [];
for (const f of frames) {
  if (f.layoutMode !== "HORIZONTAL") continue;
  if (f.name.startsWith("Dot ")) continue;
  if (f.counterAxisSizingMode === "AUTO") continue;
  const before = Math.round(f.height);
  f.counterAxisSizingMode = "AUTO";
  fixed.push({ name: f.name, before, after: Math.round(f.height) });
}
return { rootHeight: Math.round(root.height), fixed };
