const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "01 · Home", 0);

// Decorative backdrop (absolute, behind content)
const amb = absolute(rect(s, "Backdrop/photo", 0, 0, 510, 520, imgFill(img("28965748"))), -60, -80);
amb.effects = [blur(70)]; amb.opacity = 0.75;
absolute(rect(s, "Backdrop/fade", 0, 0, 390, 560, grad([[C.bg, 0.15, 0], [C.bg, 0.55, 0.45], [C.bg, 1, 0.85]], "v")), 0, 0);

statusBarAL(s);
const content = col(s, "Content", { pad: [8, 24, 0, 24] });
sizing(content, "FILL", "FILL");

// Header
const header = row(content, "Header", { main: "SPACE_BETWEEN", cross: "CENTER" });
sizing(header, "FILL", "HUG");
const greet = col(header, "Greeting", { gap: 2 });
t(greet, "Good evening", { size: 15, color: C.muted, weight: "medium" });
t(greet, "Aria", { size: 34, weight: "xbold", ls: -1 });
const actions = row(header, "Header actions", { gap: 8, cross: "CENTER" });
const bell = glassBtn(actions, "Bell button", 46, "notification-linear");
absolute(ellipse(bell, "badge", 0, 0, 9, 9, solid(C.pink)), 28, 10);
const av = ellipse(actions, "Avatar", 0, 0, 46, 46, imgFill(img("10380353")));
av.strokes = solid("#FFFFFF", 0.6); av.strokeWeight = 1.5;

sp(content, 18);
// Chips (horizontal scroll: hugs its content and may overflow the screen)
const chips = row(content, "Chips", { gap: 8 });
["All", "Music", "Podcasts", "Chill", "Workout"].forEach((label, i) => {
  const c = i === 0
    ? row(chips, "Chip/" + label + " (selected)", { pad: [9, 18], r: 19, fills: solid("#FFFFFF") })
    : glassAL(chips, "Chip/" + label, "HORIZONTAL", { pad: [9, 18], r: 19, tint: 0.08 });
  t(c, label, { size: 14, weight: i === 0 ? "semibold" : "medium", color: i === 0 ? C.bg : C.text });
});

sp(content, 24);
const h1 = row(content, "Section header/Jump back in", { main: "SPACE_BETWEEN", cross: "CENTER" });
sizing(h1, "FILL", "HUG");
t(h1, "Jump back in", { size: 22, weight: "bold", ls: -0.4 });
t(h1, "See all", { size: 14, color: C.muted, weight: "medium" });

sp(content, 12);
const hero = col(content, "Featured card", { pad: 18, r: 30, h: 196, main: "SPACE_BETWEEN", clip: true, fills: imgFill(img("7315881")) });
sizing(hero, "FILL", "FIXED");
absolute(rect(hero, "scrim", 0, 0, 342, 196, grad([["#000000", 0.05, 0], ["#1A0B2E", 0.85, 1]], "v")), 0, 0).constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
const tag = glassAL(hero, "Tag", "HORIZONTAL", { pad: [6, 12], r: 14, tint: 0.12 });
t(tag, "Playlist · 24 songs", { size: 12, weight: "semibold" });
const heroBottom = row(hero, "Bottom", { main: "SPACE_BETWEEN", cross: "MAX" });
sizing(heroBottom, "FILL", "HUG");
const heroText = col(heroBottom, "Title", { gap: 2 });
t(heroText, "Midnight Drive", { size: 30, weight: "xbold", ls: -1 });
t(heroText, "Neon Waves, Kavi, Luma", { size: 13, weight: "medium", opacity: 0.85 });
glassBtn(heroBottom, "Play (glass)", 54, "play-bold", C.text, { strong: true, tint: 0.18 });

sp(content, 24);
t(content, "Recently played", { size: 22, weight: "bold", ls: -0.4 });
sp(content, 12);
const cards = row(content, "Recently played list", { gap: 12 });
[["After Hours", "The Weeknd", "9067815"], ["Solar Bloom", "Luma", "16177323"], ["Blue Hour", "Kavi", "7315526"]].forEach(([t1, t2, id]) => {
  const card = col(cards, "Album card/" + t1, { gap: 8, w: 128 });
  sizing(card, "FIXED", "HUG");
  photoAL(card, "Cover", id, 128, 128, 22);
  const meta = col(card, "Meta", { gap: 2 });
  sizing(meta, "FILL", "HUG");
  t(meta, t1, { size: 15, weight: "semibold", fill: true });
  t(meta, t2, { size: 12, color: C.muted, fill: true });
});

// Floating dock: mini player + tab bar (absolute over content, auto layout inside)
const dock = col(s, "Dock", { gap: 8, w: 358 });
sizing(dock, "FIXED", "HUG");
absolute(dock, 16, 690);
const mini = glassAL(dock, "Mini player (Liquid Glass)", "HORIZONTAL", { pad: [8, 16, 8, 8], gap: 10, r: 22, cross: "CENTER", tint: 0.1 });
sizing(mini, "FILL", "HUG");
photoAL(mini, "Cover", "7315881", 44, 44, 14);
const mt = col(mini, "Now playing", { gap: 2 });
sizing(mt, "FILL", "HUG");
t(mt, "Blinding Lights", { size: 15, weight: "semibold", fill: true });
t(mt, "The Weeknd", { size: 12, color: C.muted, fill: true });
const mctl = row(mini, "Controls", { gap: 20, cross: "CENTER" });
icon(mctl, "heart-bold", 0, 0, 24, C.pink);
icon(mctl, "pause-bold", 0, 0, 24);
tabBarAL(dock, "home-2");
homeIndicator(s);
return { screen: s.id, glass: GLASS_OK };
