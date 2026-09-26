const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "02 · Now Playing", 1);
s.fills = grad([["#3A1C6B", 1, 0], ["#1A1033", 1, 0.45], [C.bg, 1, 1]], "v");

const g1 = ellipse(s, "glow", 20, 120, 350, 350, solid(C.pink, 0.45)); g1.effects = [glow(C.pink, 120)];
statusBar(s);

icon(s, "chevronDown", 24, 62, 28, C.text);
text(s, "PLAYING FROM PLAYLIST", 95, 60, { size: 11, style: "Semi Bold", color: C.muted, ls: 1.2, w: 200, align: "CENTER" });
text(s, "Midnight Drive", 95, 76, { size: 14, style: "Semi Bold", w: 200, align: "CENTER" });
icon(s, "more", 338, 64, 26, C.text);

const cover = art(s, "Album art", 32, 128, 326, 0, 32);
cover.effects = [shadow(C.pink, 0.45, 30, 60)];
const c2 = cover; // extra vinyl lines on the big cover
[0, 1, 2].forEach((i) => { const r = ellipse(c2, "groove", 63 - i * 30, 63 - i * 30, 200 + i * 60, 200 + i * 60, []); r.strokes = solid("#FFFFFF", 0.14); r.strokeWeight = 1; });

text(s, "Blinding Lights", 32, 488, { size: 26, style: "Bold", ls: -0.6 });
text(s, "The Weeknd", 32, 524, { size: 16, color: C.muted, style: "Medium" });
iconFilled(s, "heart", 330, 496, 28, C.pink);

rect(s, "track", 32, 574, 326, 5, solid("#FFFFFF", 0.14), 3);
rect(s, "played", 32, 574, 138, 5, grad([C.pink, C.violet], "h"), 3);
const knob = ellipse(s, "knob", 162, 569, 15, 15, solid("#FFFFFF"));
knob.effects = [shadow(C.pink, 0.8, 0, 12)];
text(s, "1:24", 32, 592, { size: 12, color: C.muted, style: "Medium" });
text(s, "3:20", 318, 592, { size: 12, color: C.muted, style: "Medium", w: 40, align: "RIGHT" });

icon(s, "shuffle", 36, 652, 24, C.muted);
iconFilled(s, "back", 96, 646, 36, C.text);
const play = ellipse(s, "play/pause", 157, 626, 76, 76, solid("#FFFFFF"));
play.effects = [shadow(C.pink, 0.55, 12, 36)];
iconFilled(s, "pause", 177, 646, 36, C.bg);
iconFilled(s, "next", 258, 646, 36, C.text);
icon(s, "repeat", 330, 652, 24, C.pink);
ellipse(s, "repeat on", 340, 682, 4, 4, solid(C.pink));

icon(s, "devices", 32, 734, 22, C.muted);
text(s, "AirPods Pro", 62, 737, { size: 13, color: C.cyan, style: "Medium" });
icon(s, "share", 294, 734, 22, C.muted);
icon(s, "queue", 336, 734, 22, C.muted);

const lyr = frame(s, "Lyrics sheet", 12, 776, 366, 120, solid("#FFFFFF", 0.08), 24);
text(lyr, "Lyrics", 20, 18, { size: 16, style: "Bold" });
icon(lyr, "chevronUp", 322, 16, 24, C.text);
text(lyr, "I've been tryna call…", 20, 44, { size: 13, color: C.muted });
rect(s, "home indicator", 128, 826, 134, 5, solid("#FFFFFF", 0.9), 3);
return { screen: s.id };
