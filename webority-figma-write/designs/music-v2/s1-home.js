const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "01 · Home", 0);

// Ambient photo wash behind the glass
const amb = photo(s, "ambient photo", img("28965748"), -60, -80, 510, 520);
amb.effects = [blur(70)]; amb.opacity = 0.75;
rect(s, "ambient fade", 0, 0, 390, 560, grad([[C.bg, 0.15, 0], [C.bg, 0.55, 0.45], [C.bg, 1, 0.85]], "v"));
statusBar(s);

text(s, "Good evening", 24, 66, { size: 15, color: C.muted, weight: "medium" });
text(s, "Aria", 24, 86, { size: 34, weight: "xbold", ls: -1 });
const bell = glassCircle(s, "Bell button", 280, 72, 46);
icon(bell, "notification-linear", 11, 11, 24);
ellipse(bell, "badge", 28, 10, 9, 9, solid(C.pink));
const av = ellipse(s, "Avatar", 334, 72, 46, 46, imgFill(img("10380353")));
av.strokes = solid("#FFFFFF", 0.6); av.strokeWeight = 1.5;

// Glass chips
const chips = [["All", 52], ["Music", 72], ["Podcasts", 92], ["Chill", 64], ["Workout", 90]];
let cx = 24;
chips.forEach(([label, w], i) => {
  const c = i === 0 ? frame(s, "chip/" + label, cx, 144, w, 38, solid("#FFFFFF"), 19) : glass(s, "chip/" + label, cx, 144, w, 38, 19, { tint: 0.08 });
  text(c, label, 0, 10, { size: 14, weight: i === 0 ? "semibold" : "medium", color: i === 0 ? C.bg : C.text, w, align: "CENTER" });
  cx += w + 8;
});

// Featured
text(s, "Jump back in", 24, 206, { size: 22, weight: "bold", ls: -0.4 });
text(s, "See all", 306, 211, { size: 14, color: C.muted, weight: "medium", w: 60, align: "RIGHT" });
const hero = frame(s, "Featured card", 24, 246, 342, 196, imgFill(img("7315881")), 30);
rect(hero, "scrim", 0, 0, 342, 196, grad([["#000000", 0.05, 0], ["#1A0B2E", 0.85, 1]], "v"));
const tag = glass(hero, "tag", 18, 18, 132, 28, 14, { tint: 0.12 });
text(tag, "Playlist · 24 songs", 0, 6, { size: 12, weight: "semibold", w: 132, align: "CENTER" });
text(hero, "Midnight Drive", 20, 118, { size: 30, weight: "xbold", ls: -1 });
text(hero, "Neon Waves, Kavi, Luma", 20, 156, { size: 13, weight: "medium", opacity: 0.85 });
const hp = glassCircle(hero, "Play (glass)", 272, 126, 54, { strong: true, tint: 0.18 });
icon(hp, "play-bold", 15, 15, 24);

// Recently played
text(s, "Recently played", 24, 460, { size: 22, weight: "bold", ls: -0.4 });
[["After Hours", "The Weeknd", "9067815"], ["Solar Bloom", "Luma", "16177323"], ["Blue Hour", "Kavi", "7315526"]].forEach(([t1, t2, id], i) => {
  const x = 24 + i * 140;
  const a = photo(s, "cover/" + t1, img(id), x, 496, 128, 128, 22);
  text(s, t1, x, 632, { size: 15, weight: "semibold", w: 128 });
  text(s, t2, x, 652, { size: 12, color: C.muted, w: 128 });
});

// Mini player (glass)
const mini = glass(s, "Mini player (Liquid Glass)", 16, 690, 358, 60, 22, { tint: 0.1 });
photo(mini, "cover", img("7315881"), 8, 8, 44, 44, 14);
text(mini, "Blinding Lights", 62, 11, { size: 15, weight: "semibold" });
text(mini, "The Weeknd", 62, 31, { size: 12, color: C.muted });
icon(mini, "heart-bold", 272, 18, 24, C.pink);
icon(mini, "pause-bold", 316, 18, 24);

tabBar(s, "home-2");
return { screen: s.id, glass: GLASS_OK };
