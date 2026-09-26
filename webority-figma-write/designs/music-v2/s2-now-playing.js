const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screen(section, "02 · Now Playing", 1);

// Full-bleed blurred cover as the backdrop
const bgp = photo(s, "backdrop photo", img("7315881"), -120, -60, 630, 960);
bgp.effects = [blur(90)];
rect(s, "backdrop tint", 0, 0, 390, 844, grad([["#12061F", 0.25, 0], ["#12061F", 0.55, 0.55], [C.bg, 0.95, 1]], "v"));
statusBar(s);

const down = glassCircle(s, "Close", 20, 58, 44);
icon(down, "arrow-down-1-linear", 10, 10, 24);
text(s, "Playing from playlist", 95, 60, { size: 11, weight: "semibold", color: C.muted, ls: 1.2, w: 200, align: "CENTER", upper: true });
text(s, "Midnight Drive", 95, 77, { size: 15, weight: "bold", w: 200, align: "CENTER" });
const more = glassCircle(s, "More", 326, 58, 44);
icon(more, "more-linear", 10, 10, 24);

const cover = photo(s, "Album cover", img("7315881"), 30, 128, 330, 330, 36);
cover.effects = [shadow("#FF3D8B", 0.45, 30, 70, -10)];

text(s, "Blinding Lights", 30, 484, { size: 30, weight: "xbold", ls: -1 });
text(s, "The Weeknd", 30, 522, { size: 17, color: C.muted, weight: "medium" });
const fav = glassCircle(s, "Favourite", 316, 488, 44);
icon(fav, "heart-bold", 10, 10, 24, C.pink);

// Scrubber
rect(s, "track", 30, 576, 330, 6, solid("#FFFFFF", 0.18), 3);
rect(s, "played", 30, 576, 140, 6, solid("#FFFFFF"), 3);
const knob = ellipse(s, "knob", 162, 571, 16, 16, solid("#FFFFFF"));
knob.effects = [shadow("#000000", 0.35, 2, 6)];
text(s, "1:24", 30, 594, { size: 12, color: C.muted, weight: "medium" });
text(s, "3:20", 320, 594, { size: 12, color: C.muted, weight: "medium", w: 40, align: "RIGHT" });

// Controls: one liquid glass capsule
const ctl = glass(s, "Controls (Liquid Glass)", 20, 628, 350, 92, 46, { strong: true, tint: 0.08 });
icon(ctl, "shuffle-outline", 22, 34, 24, C.muted);
icon(ctl, "previous-bold", 84, 28, 36);
const pp = ellipse(ctl, "play/pause", 137, 8, 76, 76, solid("#FFFFFF"));
pp.effects = [shadow("#000000", 0.3, 8, 20)];
icon(ctl, "pause-bold", 157, 28, 36, C.bg);
icon(ctl, "next-bold", 230, 28, 36);
icon(ctl, "repeat-linear", 304, 34, 24, C.pink);

// Bottom row
const out = glass(s, "Output", 20, 740, 150, 44, 22, { tint: 0.08 });
icon(out, "airpods-linear", 12, 10, 24, C.cyan);
text(out, "AirPods Pro", 44, 13, { size: 14, weight: "semibold", color: C.cyan });
const lyr = glassCircle(s, "Lyrics", 222, 740, 44);
icon(lyr, "microphone-2-linear", 10, 10, 24);
const share = glassCircle(s, "Share", 274, 740, 44);
icon(share, "export-linear", 10, 10, 24);
const q = glassCircle(s, "Queue", 326, 740, 44);
icon(q, "music-playlist-linear", 10, 10, 24);
rect(s, "home indicator", 128, 832, 134, 5, solid("#FFFFFF", 0.9), 3);
return { screen: s.id, glass: GLASS_OK };
