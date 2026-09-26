const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "03 · Playlist", 2);

const hero = photo(s, "Hero photo", img("28965748"), 0, 0, 390, 430);
rect(s, "hero fade", 0, 0, 390, 432, grad([["#000000", 0.1, 0], ["#000000", 0.2, 0.45], [C.bg, 1, 1]], "v"));
statusBar(s);
const back = glassCircle(s, "Back", 20, 58, 44);
icon(back, "arrow-left-linear", 10, 10, 24);
const more = glassCircle(s, "More", 326, 58, 44);
icon(more, "more-linear", 10, 10, 24);

const pill = glass(s, "Playlist pill", 24, 250, 104, 30, 15, { tint: 0.12 });
text(pill, "Playlist", 0, 6, { size: 13, weight: "semibold", w: 104, align: "CENTER" });
text(s, "Midnight Drive", 24, 290, { size: 36, weight: "xbold", ls: -1.4 });
const owner = ellipse(s, "owner", 24, 342, 22, 22, imgFill(img("9067815")));
text(s, "Neon Waves  ·  24 songs, 1 h 32 min", 54, 344, { size: 14, color: C.muted, weight: "medium" });

// Actions
const actions = glass(s, "Actions (Liquid Glass)", 24, 386, 162, 52, 26, { tint: 0.08 });
icon(actions, "heart-linear", 18, 14, 24);
icon(actions, "import-linear", 69, 14, 24);
icon(actions, "add-linear", 120, 14, 24);
const shuf = glassCircle(s, "Shuffle", 244, 386, 52);
icon(shuf, "shuffle-outline", 14, 14, 24, C.pink);
const play = ellipse(s, "Play", 306, 380, 64, 64, grad([C.pink, C.violet], "d"));
play.effects = [shadow(C.pink, 0.5, 10, 26)];
icon(s, "play-bold", 324, 398, 28);

const tracks = [
  ["Blinding Lights", "The Weeknd", "3:20", "7315881", true],
  ["Nightcall", "Kavinsky", "4:18", "29140640"],
  ["Midnight City", "M83", "4:03", "19830276"],
  ["Instant Crush", "Daft Punk", "5:37", "3405547"],
];
tracks.forEach(([t1, t2, d, id, on], i) => {
  const y = 462 + i * 70;
  const row = on ? glass(s, "Track/" + t1, 12, y, 366, 62, 20, { tint: 0.07 }) : frame(s, "Track/" + t1, 12, y, 366, 62, [], 20);
  photo(row, "cover", img(id), 10, 8, 46, 46, 14);
  text(row, t1, 70, 11, { size: 16, weight: "semibold", color: on ? C.pink : C.text });
  text(row, t2, 70, 34, { size: 13, color: C.muted });
  if (on) icon(row, "sound-linear", 246, 19, 24, C.pink);
  text(row, d, 276, 21, { size: 13, color: C.muted, weight: "medium", w: 40, align: "RIGHT" });
  icon(row, "more-linear", 330, 19, 24, C.muted);
});

tabBar(s, "music-library-2");
return { screen: s.id, glass: GLASS_OK };
