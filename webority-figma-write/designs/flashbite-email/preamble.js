// Flashbite promo email: fills the image slots of an already built layer tree.
// B64 is injected by design-run.js from assets/<pexels-id>.jpg for any quoted id a step mentions.
const HASH = {};
function imgPaint(id, scaleMode) {
  if (!B64[id]) throw new Error("Image not injected: " + id);
  if (!HASH[id]) HASH[id] = figma.createImage(figma.base64Decode(B64[id])).hash;
  return { type: "IMAGE", scaleMode: scaleMode || "FILL", imageHash: HASH[id] };
}
async function paintSlot(nodeId, pexelsId) {
  const n = await figma.getNodeByIdAsync(nodeId);
  if (!n) throw new Error("Slot not found: " + nodeId);
  n.fills = [imgPaint(pexelsId)];
  return n.name;
}
