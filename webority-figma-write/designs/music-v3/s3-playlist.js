const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "03 · Playlist", 2);

absolute(rect(s, "Backdrop/hero photo", 0, 0, 390, 430, imgFill(img("28965748"))), 0, 0);
absolute(rect(s, "Backdrop/fade", 0, 0, 390, 432, grad([["#000000", 0.1, 0], ["#000000", 0.2, 0.45], [C.bg, 1, 1]], "v")), 0, 0);

statusBarAL(s);
const content = col(s, "Content", { pad: [8, 24, 0, 24] });
sizing(content, "FILL", "FILL");

const top = row(content, "Top bar", { main: "SPACE_BETWEEN", cross: "CENTER" });
sizing(top, "FILL", "HUG");
glassBtn(top, "Back", 44, "arrow-left-linear");
glassBtn(top, "More", 44, "more-linear");

sp(content, 140);
const pill = glassAL(content, "Type pill", "HORIZONTAL", { pad: [6, 18], r: 15, tint: 0.12 });
t(pill, "Playlist", { size: 13, weight: "semibold" });
sp(content, 8);
t(content, "Midnight Drive", { size: 36, weight: "xbold", ls: -1.4 });
sp(content, 6);
const owner = row(content, "Owner", { gap: 8, cross: "CENTER" });
ellipse(owner, "Owner avatar", 0, 0, 22, 22, imgFill(img("9067815")));
t(owner, "Neon Waves  ·  24 songs, 1 h 32 min", { size: 14, color: C.muted, weight: "medium" });

sp(content, 22);
const act = row(content, "Actions", { main: "SPACE_BETWEEN", cross: "CENTER" });
sizing(act, "FILL", "HUG");
const tools = glassAL(act, "Actions (Liquid Glass)", "HORIZONTAL", { pad: [14, 18], gap: 26, r: 26, cross: "CENTER", tint: 0.08 });
icon(tools, "heart-linear", 0, 0, 24);
icon(tools, "import-linear", 0, 0, 24);
icon(tools, "add-linear", 0, 0, 24);
const playGroup = row(act, "Play group", { gap: 10, cross: "CENTER" });
glassBtn(playGroup, "Shuffle", 52, "shuffle-outline", C.pink);
const play = row(playGroup, "Play", { w: 64, h: 64, r: 32, main: "CENTER", cross: "CENTER", fills: grad([C.pink, C.violet], "d") });
play.effects = [shadow(C.pink, 0.5, 10, 26)];
icon(play, "play-bold", 0, 0, 28);

sp(content, 22);
const list = col(content, "Track list", { gap: 8 });
sizing(list, "FILL", "HUG");
[
  ["Blinding Lights", "The Weeknd", "3:20", "7315881", true],
  ["Nightcall", "Kavinsky", "4:18", "29140640"],
  ["Midnight City", "M83", "4:03", "19830276"],
  ["Instant Crush", "Daft Punk", "5:37", "3405547"],
].forEach(([t1, t2, d, id, on]) => {
  const r = on
    ? glassAL(list, "Track row/" + t1 + " (playing)", "HORIZONTAL", { pad: [8, 10, 8, 8], gap: 12, r: 20, cross: "CENTER", tint: 0.07 })
    : row(list, "Track row/" + t1, { pad: [8, 10, 8, 8], gap: 12, r: 20, cross: "CENTER" });
  sizing(r, "FILL", "HUG");
  photoAL(r, "Cover", id, 46, 46, 14);
  const meta = col(r, "Meta", { gap: 2 });
  sizing(meta, "FILL", "HUG");
  t(meta, t1, { size: 16, weight: "semibold", color: on ? C.pink : C.text, fill: true });
  t(meta, t2, { size: 13, color: C.muted, fill: true });
  if (on) icon(r, "sound-linear", 0, 0, 24, C.pink);
  t(r, d, { size: 13, color: C.muted, weight: "medium" });
  icon(r, "more-linear", 0, 0, 24, C.muted);
});

const dock = col(s, "Dock", { w: 358 });
sizing(dock, "FIXED", "HUG");
absolute(dock, 16, 758);
tabBarAL(dock, "music-library-2");
homeIndicator(s);
return { screen: s.id, glass: GLASS_OK };
