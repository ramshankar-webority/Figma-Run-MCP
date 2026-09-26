const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "03 · Playlist", 2);

const header = frame(s, "Header", 0, 0, 390, 380, grad([["#6D3BD8", 1, 0], ["#3A1C6B", 1, 0.6], [C.bg, 1, 1]], "v"));
const hg = ellipse(header, "glow", 60, 40, 280, 280, solid(C.pink, 0.5)); hg.effects = [glow(C.pink, 110)];
statusBar(s);
const back = ellipse(s, "back bg", 20, 56, 40, 40, solid("#000000", 0.25));
icon(s, "chevronLeft", 28, 64, 24, C.text);
const moreBg = ellipse(s, "more bg", 330, 56, 40, 40, solid("#000000", 0.25));
icon(s, "more", 338, 64, 24, C.text);

const cover = art(s, "Playlist cover", 95, 84, 200, 0, 24);
cover.effects = [shadow("#000000", 0.55, 24, 50)];

text(s, "Midnight Drive", 24, 312, { size: 28, style: "Bold", ls: -0.7 });
const owner = ellipse(s, "owner", 24, 356, 20, 20, grad([C.cyan, C.violet], "d"));
text(s, "Neon Waves  ·  24 songs, 1 h 32 min", 52, 358, { size: 13, color: C.muted, style: "Medium" });

icon(s, "heart", 24, 404, 26, C.text);
icon(s, "download", 66, 404, 26, C.text);
icon(s, "plus", 108, 404, 26, C.text);
icon(s, "shuffle", 262, 406, 24, C.pink);
const pp = ellipse(s, "play", 310, 390, 56, 56, grad([C.pink, C.violet], "d"));
pp.effects = [shadow(C.pink, 0.5, 10, 24)];
iconFilled(s, "play", 326, 406, 26, C.text);

const tracks = [
  ["Blinding Lights", "The Weeknd", "3:20", 0, true],
  ["Nightcall", "Kavinsky", "4:18", 1],
  ["Midnight City", "M83", "4:03", 4],
  ["Instant Crush", "Daft Punk", "5:37", 2],
];
tracks.forEach(([t1, t2, d, p, on], i) => {
  const y = 470 + i * 70;
  const row = frame(s, "Track/" + t1, 12, y, 366, 62, on ? solid("#FFFFFF", 0.06) : [], 16);
  art(row, "art", 12, 8, 46, p, 12);
  text(row, t1, 72, 12, { size: 15, style: "Semi Bold", color: on ? C.pink : C.text });
  text(row, t2, 72, 34, { size: 13, color: C.muted });
  if (on) [8, 14, 6, 11].forEach((h, k) => rect(row, "eq", 252 + k * 5, 31 - h / 2 + 1, 3, h, solid(C.pink), 1.5));
  text(row, d, 280, 22, { size: 13, color: C.muted, style: "Medium", w: 40, align: "RIGHT" });
  icon(row, "more", 330, 19, 22, C.muted);
});

bottomNav(s, "library");
return { screen: s.id };
