const ids = IDS;
const ref = ["790:983", "790:1043", "823:813", "823:1050", "790:963", "823:862", "790:1186"]; // library originals for comparison
const hexOf = (p) => p && p.type === "SOLID" ? "#" + [p.color.r, p.color.g, p.color.b].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase() : (p ? p.type : null);
const rel = (n, s) => ({ x: Math.round(n.absoluteBoundingBox.x - s.absoluteBoundingBox.x), y: Math.round(n.absoluteBoundingBox.y - s.absoluteBoundingBox.y), w: Math.round(n.absoluteBoundingBox.width), h: Math.round(n.absoluteBoundingBox.height) });
async function inspect(id) {
  const s = await figma.getNodeByIdAsync(id);
  const texts = s.findAll(n => n.type === "TEXT" && n.visible).map(t => {
    const segs = t.getStyledTextSegments(["fontName", "fontSize", "fills"]);
    return { chars: t.characters, box: rel(t, s), segs: segs.map(g => ({ t: g.characters.slice(0, 30), font: g.fontName.family + " " + g.fontName.style, size: g.fontSize, fill: hexOf(g.fills[0]) })), autoResize: t.textAutoResize, lines: Math.round(t.height / (Math.max(...segs.map(g => g.fontSize)) * 1.21)) };
  });
  const renders = s.findAll(n => n.visible && "fills" in n && Array.isArray(n.fills) && n.fills.some(f => f.type === "IMAGE") && (n.name === "Object" || /^[0-9a-f-]{20,}/.test(n.name))).map(n => rel(n, s));
  const infos = s.findAll(n => n.name.startsWith("Infographic")).map(n => rel(n, s));
  const hiddenText = s.findAll(n => n.type === "TEXT" && (!n.visible || n.opacity === 0)).map(n => n.characters.slice(0, 30));
  const outside = s.findAll(n => n.visible && n.type === "TEXT").filter(t => { const b = rel(t, s); return b.x < 60 || b.x + b.w > 1140 || b.y + b.h > 1440; }).map(t => ({ chars: t.characters.slice(0, 30), box: rel(t, s) })).filter(o => o.chars !== "capnix.ai" && !/^\d\d$|^\/10$|Swipe/.test(o.chars));
  return { id, name: s.name, w: s.width, h: s.height, texts, renders, infos, hiddenText, outside };
}
const out = { gen: [], ref: [] };
for (const id of ids) out.gen.push(await inspect(id));
for (const id of ref) out.ref.push(await inspect(id));
return out;
