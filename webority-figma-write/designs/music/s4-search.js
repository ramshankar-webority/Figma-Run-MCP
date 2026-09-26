const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "04 · Search", 3);
const g1 = ellipse(s, "glow", 180, -140, 360, 300, solid(C.cyan, 0.25)); g1.effects = [glow(C.cyan, 140)];
statusBar(s);

text(s, "Search", 24, 64, { size: 32, style: "Bold", ls: -0.8 });
const field = frame(s, "Search field", 24, 120, 342, 52, solid("#FFFFFF", 0.08), 16);
icon(field, "search", 16, 14, 24, C.muted);
text(field, "Artists, songs or podcasts", 52, 16, { size: 15, color: C.muted });

text(s, "Browse all", 24, 200, { size: 20, style: "Bold", ls: -0.3 });
const genres = [["Pop", 0], ["Hip-Hop", 2], ["Chill", 1], ["Rock", 5], ["Focus", 3], ["Indie", 4]];
genres.forEach(([name, p], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const [a, b] = PAL[p];
  const tile = frame(s, "Genre/" + name, 24 + col * 177, 238 + row * 112, 165, 100, grad([a, b], "d"), 20);
  const o = ellipse(tile, "orb", 90, -30, 110, 110, solid("#FFFFFF", 0.22)); o.effects = [glow("#fff", 30)];
  text(tile, name, 16, 16, { size: 18, style: "Bold" });
  const mini = art(tile, "art", 104, 44, 62, p + 1, 10);
  mini.rotation = -20;
  mini.effects = [shadow("#000000", 0.35, 8, 16)];
});

text(s, "Top artists", 24, 586, { size: 20, style: "Bold", ls: -0.3 });
[["The Weeknd", 0], ["Luma", 1], ["Kavi", 2], ["M83", 4]].forEach(([n, p], i) => {
  const x = 24 + i * 88;
  const a = art(s, "artist/" + n, x, 624, 72, p, 36);
  text(s, n, x - 8, 704, { size: 12, style: "Medium", w: 88, align: "CENTER" });
});

bottomNav(s, "search");
return { screen: s.id };
