// Tree rules shared by plan-assets.mjs and figma-to-html.mjs, so the two always agree on what an asset is.

export const VECTOR_TYPES = new Set(["VECTOR", "LINE", "STAR", "POLYGON", "BOOLEAN_OPERATION", "ELLIPSE"]);
const CONTAINERS = new Set(["GROUP", "FRAME", "INSTANCE", "COMPONENT"]);

// True when a layer draws only vectors, so it can ship as one SVG. Hidden children never disqualify it.
export function isVectorOnly(node) {
  if (VECTOR_TYPES.has(node.type)) return true;
  if (CONTAINERS.has(node.type) && Array.isArray(node.children) && node.children.length) {
    return node.children.every((c) => c.visible === false || isVectorOnly(c));
  }
  return false;
}
