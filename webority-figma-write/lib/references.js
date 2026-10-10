// Design references: the rules that make Claude look at real products (Mobbin) before designing,
// the image fetch for figma_place_references, and the Figma script that lays out the reference board.

import fs from "node:fs";

export const REFERENCE_MAX_BYTES = 8 * 1024 * 1024;
export const REFERENCE_MAX_TOTAL = 30 * 1024 * 1024;

export const REFERENCE_RULES = `Design references (Mobbin)
Before designing a new screen, flow or website section from scratch, look at how shipped products solve it.
- If a Mobbin MCP is connected (tools search_screens, search_flows, search_sections), search it first: search_screens (platform ios or web) for one screen, search_flows for a multi-step journey, search_sections for a website section. Use image_format "jpg" (Figma cannot read webp) and output_destination "design_tool". One intent per query.
- Pick 3 to 6 strong matches, then call figma_place_references with each result's image_url as imageUrl, mobbin_url as sourceUrl and app_name as title, plus a one-line note on what to take from it. The board lands next to the frame you are designing (nextTo), so the person sees what informed the design.
- Design from the patterns (structure, hierarchy, component choices, copy tone), never copy a screen pixel for pixel, and keep the Webority colour tokens and the file's own styles.
- Skip references for small edits to an existing design, or when the person says not to. No Mobbin MCP: say so once and design without it.
- Prompt design_with_references runs the whole sequence.`;

function sniff(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes.slice(0, 4).toString("ascii") === "RIFF" && bytes.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

// One reference image as bytes: an https URL (redirects followed) or a local file path.
export async function loadReferenceImage({ imageUrl, path: filePath }, { fetchImpl = fetch } = {}) {
  let bytes;
  if (filePath) {
    if (!fs.existsSync(filePath)) throw new Error("File not found: " + filePath);
    bytes = fs.readFileSync(filePath);
  } else {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") throw new Error("Only https image URLs are fetched: " + imageUrl);
    const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Image download failed (${res.status}): ${imageUrl}`);
    bytes = Buffer.from(await res.arrayBuffer());
  }
  if (bytes.length > REFERENCE_MAX_BYTES) throw new Error(`Image over ${REFERENCE_MAX_BYTES / 1048576} MB: ${imageUrl || filePath}`);
  const mime = sniff(bytes);
  if (mime === "image/webp") throw new Error("Figma cannot read webp. Search Mobbin again with image_format \"jpg\": " + (imageUrl || filePath));
  if (!mime) throw new Error("Not a PNG, JPG or GIF image: " + (imageUrl || filePath));
  return { bytes, mime };
}

// Plugin API body (run through the execute command): builds a wrapping auto-layout board of cards,
// each the screenshot with the app name (linked to its source) and the note under it.
export function boardScript({ cards, boardName, nextTo, cardWidth, columns }) {
  return `const CARDS = ${JSON.stringify(cards)};
const W = ${cardWidth}, COLS = ${columns}, GAP = 32, PAD = 40;
let font = null;
for (const f of [{ family: "Inter", style: "Regular" }, { family: "Roboto", style: "Regular" }, { family: "Arial", style: "Regular" }]) {
  try { await figma.loadFontAsync(f); font = f; break; } catch (e) {}
}
let bold = font;
if (font) { try { const b = { family: font.family, style: font.family === "Arial" ? "Bold" : "Semi Bold" }; await figma.loadFontAsync(b); bold = b; } catch (e) {} }
const board = figma.createFrame();
board.name = ${JSON.stringify(boardName)};
board.layoutMode = "HORIZONTAL";
board.layoutWrap = "WRAP";
board.itemSpacing = GAP;
board.counterAxisSpacing = GAP;
board.paddingLeft = board.paddingRight = board.paddingTop = board.paddingBottom = PAD;
// resize() sets both sizing modes to FIXED, so it comes before the AUTO height.
board.resize(PAD * 2 + Math.min(COLS, CARDS.length) * W + (Math.min(COLS, CARDS.length) - 1) * GAP, 100);
board.primaryAxisSizingMode = "FIXED";
board.counterAxisSizingMode = "AUTO";
board.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.97 } }];
board.cornerRadius = 24;
const placed = [];
for (const c of CARDS) {
  const img = figma.createImage(figma.base64Decode(c.b64));
  const size = await img.getSizeAsync();
  const card = figma.createFrame();
  card.name = c.title || "Reference";
  card.layoutMode = "VERTICAL";
  card.itemSpacing = 10;
  card.resize(W, 100);
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED";
  card.fills = [];
  const shot = figma.createRectangle();
  shot.name = "Screenshot";
  shot.resize(W, Math.max(1, Math.round(W * size.height / size.width)));
  shot.cornerRadius = 12;
  shot.fills = [{ type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" }];
  shot.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 4 }, radius: 16, spread: 0, visible: true, blendMode: "NORMAL" }];
  card.appendChild(shot);
  if (font && (c.title || c.sourceUrl)) {
    const t = figma.createText();
    t.fontName = bold;
    t.fontSize = 16;
    t.characters = c.title || c.sourceUrl;
    if (c.sourceUrl) t.setRangeHyperlink(0, t.characters.length, { type: "URL", value: c.sourceUrl });
    card.appendChild(t);
    t.layoutSizingHorizontal = "FILL";
  }
  if (font && c.note) {
    const n = figma.createText();
    n.fontName = font;
    n.fontSize = 13;
    n.characters = c.note;
    n.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.42, b: 0.47 } }];
    card.appendChild(n);
    n.layoutSizingHorizontal = "FILL";
  }
  card.setPluginData("reference", JSON.stringify({ title: c.title || null, sourceUrl: c.sourceUrl || null, note: c.note || null }));
  board.appendChild(card);
  placed.push({ id: card.id, name: card.name });
}
const anchorId = ${JSON.stringify(nextTo || null)};
const anchor = anchorId ? await figma.getNodeByIdAsync(anchorId) : figma.currentPage.selection[0];
const box = anchor && anchor.absoluteBoundingBox;
if (box) { board.x = box.x + box.width + 160; board.y = box.y; }
else { board.x = Math.round(figma.viewport.center.x - board.width / 2); board.y = Math.round(figma.viewport.center.y - board.height / 2); }
figma.currentPage.appendChild(board);
figma.viewport.scrollAndZoomIntoView([board]);
return { boardId: board.id, name: board.name, cards: placed, captions: !!font, nextTo: anchor ? anchor.id : null };`;
}
