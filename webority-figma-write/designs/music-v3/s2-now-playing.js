const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "02 · Now Playing", 1);

const bgp = absolute(rect(s, "Backdrop/photo", 0, 0, 630, 960, imgFill(img("7315881"))), -120, -60);
bgp.effects = [blur(90)];
absolute(rect(s, "Backdrop/tint", 0, 0, 390, 844, grad([["#12061F", 0.25, 0], ["#12061F", 0.55, 0.55], [C.bg, 0.95, 1]], "v")), 0, 0);

statusBarAL(s);
const content = col(s, "Content", { pad: [8, 30, 0, 30] });
sizing(content, "FILL", "FILL");

const top = row(content, "Top bar", { main: "SPACE_BETWEEN", cross: "CENTER" });
sizing(top, "FILL", "HUG");
glassBtn(top, "Close", 44, "arrow-down-1-linear");
const src = col(top, "Source", { gap: 2, cross: "CENTER" });
t(src, "Playing from playlist", { size: 11, weight: "semibold", color: C.muted, ls: 1.2, upper: true });
t(src, "Midnight Drive", { size: 15, weight: "bold" });
glassBtn(top, "More", 44, "more-linear");

sp(content, 22);
const cover = rect(content, "Album cover", 0, 0, 330, 330, imgFill(img("7315881")), 36);
sizing(cover, "FILL", "FIXED");
cover.effects = [shadow("#FF3D8B", 0.45, 30, 70, -10)];

sp(content, 26);
const titleRow = row(content, "Track info", { main: "SPACE_BETWEEN", cross: "CENTER", gap: 12 });
sizing(titleRow, "FILL", "HUG");
const info = col(titleRow, "Title", { gap: 4 });
sizing(info, "FILL", "HUG");
t(info, "Blinding Lights", { size: 30, weight: "xbold", ls: -1, fill: true });
t(info, "The Weeknd", { size: 17, color: C.muted, weight: "medium", fill: true });
glassBtn(titleRow, "Favourite", 44, "heart-bold", C.pink);

sp(content, 22);
const scrub = col(content, "Scrubber", { gap: 10 });
sizing(scrub, "FILL", "HUG");
const track = row(scrub, "Track", { r: 3, h: 6, fills: solid("#FFFFFF", 0.18) });
sizing(track, "FILL", "FIXED");
const played = rect(track, "Played", 0, 0, 140, 6, solid("#FFFFFF"), 3);
const knob = absolute(ellipse(track, "Knob", 0, 0, 16, 16, solid("#FFFFFF")), 132, -5);
knob.effects = [shadow("#000000", 0.35, 2, 6)];
const times = row(scrub, "Times", { main: "SPACE_BETWEEN" });
sizing(times, "FILL", "HUG");
t(times, "1:24", { size: 12, color: C.muted, weight: "medium" });
t(times, "3:20", { size: 12, color: C.muted, weight: "medium" });

sp(content, 26);
const ctl = glassAL(content, "Controls (Liquid Glass)", "HORIZONTAL", { pad: [8, 22], r: 46, h: 92, main: "SPACE_BETWEEN", cross: "CENTER", strong: true, tint: 0.08 });
sizing(ctl, "FILL", "FIXED");
icon(ctl, "shuffle-outline", 0, 0, 24, C.muted);
icon(ctl, "previous-bold", 0, 0, 36);
const pp = row(ctl, "Play/Pause", { w: 76, h: 76, r: 38, main: "CENTER", cross: "CENTER", fills: solid("#FFFFFF") });
pp.effects = [shadow("#000000", 0.3, 8, 20)];
icon(pp, "pause-bold", 0, 0, 36, C.bg);
icon(ctl, "next-bold", 0, 0, 36);
icon(ctl, "repeat-linear", 0, 0, 24, C.pink);

sp(content, 20);
const bottom = row(content, "Bottom actions", { main: "SPACE_BETWEEN", cross: "CENTER" });
sizing(bottom, "FILL", "HUG");
const out = glassAL(bottom, "Output device", "HORIZONTAL", { pad: [10, 16, 10, 12], gap: 8, r: 22, cross: "CENTER", tint: 0.08 });
icon(out, "airpods-linear", 0, 0, 24, C.cyan);
t(out, "AirPods Pro", { size: 14, weight: "semibold", color: C.cyan });
const right = row(bottom, "Actions", { gap: 8, cross: "CENTER" });
glassBtn(right, "Lyrics", 44, "microphone-2-linear");
glassBtn(right, "Share", 44, "export-linear");
glassBtn(right, "Queue", 44, "music-playlist-linear");
homeIndicator(s);
return { screen: s.id, glass: GLASS_OK };
