const section = await figma.getNodeByIdAsync(SECTION_ID);
const s = screenAL(section, "04 · Search", 3);

const amb = absolute(rect(s, "Backdrop/photo", 0, 0, 470, 420, imgFill(img("6985132"))), -40, -120);
amb.effects = [blur(60)]; amb.opacity = 0.7;
absolute(rect(s, "Backdrop/fade", 0, 0, 390, 420, grad([[C.bg, 0.1, 0], [C.bg, 1, 1]], "v")), 0, 0);

statusBarAL(s);
const content = col(s, "Content", { pad: [8, 24, 0, 24] });
sizing(content, "FILL", "FILL");

t(content, "Search", { size: 36, weight: "xbold", ls: -1.4 });
sp(content, 14);
const field = glassAL(content, "Search field (Liquid Glass)", "HORIZONTAL", { pad: [7, 7, 7, 18], gap: 12, r: 27, cross: "CENTER", tint: 0.1 });
sizing(field, "FILL", "HUG");
icon(field, "search-normal-1-linear", 0, 0, 24, C.muted);
t(field, "Artists, songs or podcasts", { size: 16, color: C.muted, weight: "medium", fill: true });
glassBtn(field, "Filter", 40, "setting-4-linear", C.text, { tint: 0.14 });

sp(content, 26);
t(content, "Browse all", { size: 22, weight: "bold", ls: -0.4 });
sp(content, 16);
const grid = col(content, "Genre grid", { gap: 12 });
sizing(grid, "FILL", "HUG");
const genres = [["Pop", "10380353", "#FF4D8D"], ["Hip-Hop", "11711170", "#F59E0B"], ["Chill", "7130481", "#38E1FF"], ["Rock", "34731922", "#EF4444"], ["Focus", "7130491", "#8B5CF6"], ["Indie", "15561083", "#10B981"]];
for (let i = 0; i < genres.length; i += 2) {
  const r = row(grid, "Row", { gap: 12 });
  sizing(r, "FILL", "HUG");
  for (const [name, id, tint] of genres.slice(i, i + 2)) {
    const tile = col(r, "Genre tile/" + name, { pad: 10, r: 24, h: 98, main: "MAX", clip: true, fills: imgFill(img(id)) });
    sizing(tile, "FILL", "FIXED");
    const tintRect = absolute(rect(tile, "Tint", 0, 0, 165, 98, grad([[tint, 0.85, 0], [tint, 0.15, 1]], "h")), 0, 0);
    const lbl = glassAL(tile, "Label", "HORIZONTAL", { pad: [5, 16], r: 15, tint: 0.16 });
    t(lbl, name, { size: 15, weight: "bold" });
  }
}

// Size tints after both tiles in each row exist (FILL widths settle only then), then let them stretch.
for (const tn of grid.findAll((n) => n.name === "Tint")) { tn.resize(tn.parent.width, tn.parent.height); tn.constraints = { horizontal: "STRETCH", vertical: "STRETCH" }; }

sp(content, 26);
t(content, "Top artists", { size: 22, weight: "bold", ls: -0.4 });
sp(content, 16);
const artists = row(content, "Top artists list", { main: "SPACE_BETWEEN" });
sizing(artists, "FILL", "HUG");
[["The Weeknd", "9067815"], ["Luma", "7315881"], ["Kavi", "16177323"], ["M83", "10380353"]].forEach(([n, id]) => {
  const a = col(artists, "Artist/" + n, { gap: 8, cross: "CENTER" });
  const e = ellipse(a, "Photo", 0, 0, 74, 74, imgFill(img(id)));
  e.strokes = solid("#FFFFFF", 0.35); e.strokeWeight = 1.5;
  t(a, n, { size: 13, weight: "semibold" });
});

const dock = col(s, "Dock", { w: 358 });
sizing(dock, "FIXED", "HUG");
absolute(dock, 16, 758);
tabBarAL(dock, "search-normal-1");
homeIndicator(s);
return { screen: s.id, glass: GLASS_OK };
