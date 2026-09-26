const sec = await figma.getNodeByIdAsync("2002:1710");
const lite = (a, y, r) => ({ type: "DROP_SHADOW", color: { r: 7 / 255, g: 20 / 255, b: 55 / 255, a }, offset: { x: 0, y }, radius: r, spread: 0, visible: true, blendMode: "NORMAL" });
const hit = [];
for (const node of sec.findAll((x) => x.name === "knob" || x.name === "Tab bar (Liquid Glass)")) {
  const rest = node.effects.filter((e) => e.type !== "DROP_SHADOW");
  node.effects = node.name === "knob" ? [lite(0.15, 2, 4), ...rest] : [lite(0.06, 6, 20), ...rest];
  hit.push(node.name + " @ " + node.parent.name);
}
return hit;
