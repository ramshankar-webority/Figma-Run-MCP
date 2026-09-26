const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "01 · Home", 0);

const g1 = ellipse(s, "glow pink", -120, -160, 420, 360, solid(C.pink, 0.35)); g1.effects = [glow(C.pink, 140)];
const g2 = ellipse(s, "glow violet", 170, -120, 360, 320, solid(C.violet, 0.4)); g2.effects = [glow(C.violet, 140)];
statusBar(s);

text(s, "Good evening", 24, 64, { size: 14, color: C.muted, style: "Medium" });
text(s, "Aria", 24, 84, { size: 30, style: "Bold", ls: -0.5 });
const bellBg = ellipse(s, "bell bg", 282, 70, 44, 44, solid("#FFFFFF", 0.08));
icon(s, "bell", 293, 81, 22, C.text);
ellipse(s, "notif", 310, 78, 8, 8, solid(C.pink));
const av = ellipse(s, "avatar", 334, 70, 44, 44, grad([C.cyan, C.violet], "d"));
text(s, "A", 334, 81, { size: 17, style: "Bold", w: 44, align: "CENTER" });

// Chips
const chips = figma.createFrame(); s.appendChild(chips);
chips.name = "Chips"; chips.layoutMode = "HORIZONTAL"; chips.itemSpacing = 8; chips.fills = [];
chips.primaryAxisSizingMode = "AUTO"; chips.counterAxisSizingMode = "AUTO"; chips.x = 24; chips.y = 136;
["All", "Music", "Podcasts", "Chill", "Workout"].forEach((label, i) => {
  const c = figma.createFrame(); chips.appendChild(c);
  c.name = "chip/" + label; c.layoutMode = "HORIZONTAL"; c.primaryAxisSizingMode = "AUTO"; c.counterAxisSizingMode = "AUTO";
  c.paddingLeft = c.paddingRight = 18; c.paddingTop = c.paddingBottom = 9; c.cornerRadius = 999;
  c.fills = i === 0 ? solid("#FFFFFF") : solid("#FFFFFF", 0.08);
  const t = figma.createText(); c.appendChild(t);
  t.fontName = { family: "Inter", style: i === 0 ? "Semi Bold" : "Medium" }; t.characters = label; t.fontSize = 14;
  t.fills = solid(i === 0 ? C.bg : C.text);
});

// Featured
text(s, "Jump back in", 24, 196, { size: 20, style: "Bold", ls: -0.3 });
text(s, "See all", 314, 200, { size: 14, color: C.muted, style: "Medium", w: 52, align: "RIGHT" });
const hero = frame(s, "Featured card", 24, 234, 342, 188, grad([C.violet, C.pink, "#FF9A5A"], "d"), 28);
const h1 = ellipse(hero, "orb", 180, -60, 240, 240, solid("#FFFFFF", 0.25)); h1.effects = [glow("#fff", 50)];
const h2 = ellipse(hero, "orb", -60, 90, 220, 220, solid("#2B1055", 0.6)); h2.effects = [glow("#000", 60)];
[0, 1, 2, 3].forEach((i) => { const ring = ellipse(hero, "ring", 210 - i * 22, 30 - i * 22, 120 + i * 44, 120 + i * 44, []); ring.strokes = solid("#FFFFFF", 0.22 - i * 0.04); ring.strokeWeight = 1.5; });
text(hero, "PLAYLIST · 24 SONGS", 22, 22, { size: 11, style: "Semi Bold", ls: 1.2, opacity: 0.85 });
text(hero, "Midnight\nDrive", 22, 46, { size: 32, style: "Bold", ls: -0.8, lh: 34 });
text(hero, "Neon Waves, Kavi, Luma", 22, 124, { size: 13, style: "Medium", opacity: 0.85 });
const pb = ellipse(hero, "play button", 270, 118, 52, 52, solid("#FFFFFF"));
iconFilled(hero, "play", 284, 131, 26, C.bg);

// Recently played
text(s, "Recently played", 24, 446, { size: 20, style: "Bold", ls: -0.3 });
const recent = [["After Hours", "The Weeknd", 1], ["Solar Bloom", "Luma", 2], ["Deep Focus", "Various", 3]];
recent.forEach(([t1, t2, p], i) => {
  const x = 24 + i * 152;
  const a = art(s, "art/" + t1, x, 484, 140, p, 20);
  text(s, t1, x, 634, { size: 14, style: "Semi Bold", w: 140 });
  text(s, t2, x, 654, { size: 12, color: C.muted, w: 140 });
});

// Mini player
const mini = frame(s, "Mini player", 12, 688, 366, 66, solid("#1C1A2E"), 18);
mini.effects = [shadow("#000000", 0.5, 12, 30)];
art(mini, "art/mini", 10, 10, 46, 0, 12);
text(mini, "Blinding Lights", 68, 14, { size: 14, style: "Semi Bold" });
text(mini, "The Weeknd", 68, 34, { size: 12, color: C.muted });
iconFilled(mini, "heart", 270, 21, 24, C.pink);
iconFilled(mini, "pause", 318, 21, 24, C.text);
rect(mini, "progress track", 14, 62, 338, 2, solid("#FFFFFF", 0.12), 1);
rect(mini, "progress", 14, 62, 150, 2, grad([C.pink, C.violet], "h"), 1);

bottomNav(s, "home");
return { screen: s.id };
