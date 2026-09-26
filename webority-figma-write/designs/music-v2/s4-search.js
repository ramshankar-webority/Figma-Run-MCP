const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "04 · Search", 3);
const amb = photo(s, "ambient photo", img("6985132"), -40, -120, 470, 420);
amb.effects = [blur(60)]; amb.opacity = 0.7;
rect(s, "ambient fade", 0, 0, 390, 420, grad([[C.bg, 0.1, 0], [C.bg, 1, 1]], "v"));
statusBar(s);

text(s, "Search", 24, 66, { size: 36, weight: "xbold", ls: -1.4 });
const field = glass(s, "Search field (Liquid Glass)", 24, 124, 342, 54, 27, { tint: 0.1 });
icon(field, "search-normal-1-linear", 18, 15, 24, C.muted);
text(field, "Artists, songs or podcasts", 54, 17, { size: 16, color: C.muted, weight: "medium" });
const filt = glassCircle(field, "Filter", 300, 7, 40, { tint: 0.14 });
icon(filt, "setting-4-linear", 8, 8, 24);

text(s, "Browse all", 24, 204, { size: 22, weight: "bold", ls: -0.4 });
const genres = [["Pop", "10380353", "#FF4D8D"], ["Hip-Hop", "11711170", "#F59E0B"], ["Chill", "7130481", "#38E1FF"], ["Rock", "34731922", "#EF4444"], ["Focus", "7130491", "#8B5CF6"], ["Indie", "15561083", "#10B981"]];
genres.forEach(([name, id, tint], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const tile = frame(s, "Genre/" + name, 24 + col * 177, 244 + row * 110, 165, 98, imgFill(img(id)), 24);
  rect(tile, "tint", 0, 0, 165, 98, grad([[tint, 0.85, 0], [tint, 0.15, 1]], "h"));
  const lbl = glass(tile, "label", 10, 58, 92, 30, 15, { tint: 0.16 });
  text(lbl, name, 0, 5, { size: 15, weight: "bold", w: 92, align: "CENTER" });
});

text(s, "Top artists", 24, 586, { size: 22, weight: "bold", ls: -0.4 });
[["The Weeknd", "9067815"], ["Luma", "7315881"], ["Kavi", "16177323"], ["M83", "10380353"]].forEach(([n, id], i) => {
  const x = 24 + i * 88;
  const a = ellipse(s, "artist/" + n, x, 624, 74, 74, imgFill(img(id)));
  a.strokes = solid("#FFFFFF", 0.35); a.strokeWeight = 1.5;
  text(s, n, x - 8, 706, { size: 13, weight: "semibold", w: 90, align: "CENTER" });
});

tabBar(s, "search-normal-1");
return { screen: s.id, glass: GLASS_OK };
