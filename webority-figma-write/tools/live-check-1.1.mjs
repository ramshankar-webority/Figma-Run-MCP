// Live check of the 1.1.0 tool families against the real Figma plugin.
// Spawns server.js as a stdio MCP client, builds a scratch page, and exercises every new tool.
//
//   node tools/live-check-1.1.mjs <outDir>
//
// Needs: the Webority Figma Write plugin open in the design editor with "Allow edits" ticked,
// and port 3692 free (stop any other server.js first). Writes a report and images into outDir.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const outDir = process.argv[2] || path.join(os.tmpdir(), "figma-live-check");
fs.mkdirSync(outDir, { recursive: true });
const libDir = path.join(outDir, "library");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ["server.js"], {
  cwd: root,
  env: { ...process.env, FIGMA_WRITE_LIBRARY_DIR: libDir },
  stdio: ["pipe", "pipe", "pipe"],
});
child.stderr.on("data", (d) => process.stderr.write(String(d)));
let buf = "";
const replies = new Map();
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim()) {
      const m = JSON.parse(line);
      if (m.id != null) replies.set(m.id, m);
    }
  }
});
let seq = 0;
const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
async function rpc(method, params, timeoutMs = 180000) {
  const id = ++seq;
  send({ jsonrpc: "2.0", id, method, params });
  const end = Date.now() + timeoutMs;
  while (!replies.has(id)) {
    if (Date.now() > end) throw new Error(`no reply to ${method} in ${timeoutMs}ms`);
    await wait(25);
  }
  const r = replies.get(id);
  if (r.error) throw new Error(r.error.message);
  return r.result;
}
async function tool(name, args = {}, timeoutMs) {
  const r = await rpc("tools/call", { name, arguments: args }, timeoutMs);
  const textPart = (r.content || []).find((c) => c.type === "text");
  const images = (r.content || []).filter((c) => c.type === "image");
  let data = null;
  try {
    data = textPart ? JSON.parse(textPart.text) : null;
  } catch {
    data = textPart.text;
  }
  if (r.isError) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return { data, images };
}

const results = [];
async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log("PASS " + name + "  " + JSON.stringify(detail ?? null).slice(0, 220));
    return detail;
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log("FAIL " + name + "  " + e.message);
    return null;
  }
}
const saveImage = (img, file) => fs.writeFileSync(path.join(outDir, file), Buffer.from(img.data, "base64"));

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "live-check", version: "1.1.0" } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });

const tools = (await rpc("tools/list", {})).tools.map((t) => t.name);
console.log(`${tools.length} tools loaded`);

// Wait for the plugin, in the design editor, with edits allowed.
let status = null;
const waitSeconds = Number(process.env.LIVE_CHECK_WAIT_SECONDS || 600);
for (let i = 0; i < waitSeconds; i++) {
  status = (await tool("figma_write_status")).data;
  if (status.connected && status.editorType === "figma" && status.editsAllowed) break;
  if (i === 0) console.log("Waiting for the plugin with Allow edits ticked... " + JSON.stringify(status));
  await wait(1000);
}
if (!(status.connected && status.editsAllowed)) {
  console.log("FAIL plugin not ready: " + JSON.stringify(status));
  child.kill();
  process.exit(1);
}
console.log("Plugin ready: " + JSON.stringify(status));
const originalPageId = status.currentPage.id;

// ---- scratch page with things to test against ----

const build = await step("build scratch page", async () => {
  const code = `
    const page = figma.createPage();
    page.name = "MCP test";
    await figma.setCurrentPageAsync(page);
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    // A component set with a variant property and a text property.
    const make = (size) => {
      const c = figma.createComponent();
      c.name = "Size=" + size;
      c.resize(size === "Large" ? 180 : 120, size === "Large" ? 56 : 40);
      c.layoutMode = "HORIZONTAL";
      c.primaryAxisAlignItems = "CENTER";
      c.counterAxisAlignItems = "CENTER";
      c.cornerRadius = 8;
      c.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.25, b: 0.16 } }];
      const t = figma.createText();
      t.characters = "Button";
      t.fontSize = size === "Large" ? 18 : 14;
      t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      c.appendChild(t);
      return c;
    };
    const set = figma.combineAsVariants([make("Small"), make("Large")], page);
    set.name = "Button";
    set.x = 0; set.y = 0;
    const labelProp = set.children[0].children[0];
    const propId = set.addComponentProperty("Label", "TEXT", "Button");
    for (const v of set.children) {
      const txt = v.children[0];
      txt.componentPropertyReferences = { characters: propId };
    }
    const instance = set.defaultVariant.createInstance();
    instance.x = 260; instance.y = 0;
    instance.name = "Buy button";
    page.appendChild(instance);

    // Shader targets.
    const card = figma.createRectangle();
    card.name = "Shader card"; card.resize(420, 260); card.x = 0; card.y = 160; card.cornerRadius = 20;
    page.appendChild(card);
    const glassCard = figma.createRectangle();
    glassCard.name = "Glass card"; glassCard.resize(200, 120); glassCard.x = 460; glassCard.y = 160; glassCard.cornerRadius = 16;
    page.appendChild(glassCard);

    // Slides inside a section, for the slideshow video.
    const section = figma.createSection();
    section.name = "Slides"; section.x = 0; section.y = 470; section.resizeWithoutConstraints(980, 300);
    const slides = [];
    for (let i = 0; i < 3; i++) {
      const f = figma.createFrame();
      f.name = "Slide " + (i + 1);
      f.resize(300, 200);
      f.x = 20 + i * 320; f.y = 520;
      f.fills = [{ type: "SOLID", color: { r: i === 0 ? 0.9 : 0.1, g: i === 1 ? 0.8 : 0.15, b: i === 2 ? 0.9 : 0.2 } }];
      const t = figma.createText();
      t.characters = "Slide " + (i + 1);
      t.fontSize = 32; t.x = 24; t.y = 24;
      t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      f.appendChild(t);
      section.appendChild(f);
      slides.push(f.id);
    }
    page.appendChild(section);

    // Spinner for the animated video.
    const spinner = figma.createFrame();
    spinner.name = "Spinner"; spinner.resize(200, 200); spinner.x = 1040; spinner.y = 160;
    spinner.fills = [{ type: "SOLID", color: { r: 0.07, g: 0.07, b: 0.1 } }];
    const bar = figma.createRectangle();
    bar.name = "Bar"; bar.resize(20, 80); bar.x = 90; bar.y = 20; bar.cornerRadius = 10;
    bar.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.25, b: 0.16 } }];
    spinner.appendChild(bar);
    page.appendChild(spinner);

    return { pageId: page.id, setId: set.id, instanceId: instance.id, cardId: card.id, glassId: glassCard.id, sectionId: section.id, spinnerId: spinner.id, slides };
  `;
  const r = await tool("figma_execute", { code, timeoutMs: 60000 });
  return r.data.result;
});
if (!build) {
  child.kill();
  process.exit(1);
}

// ---- Code Connect ----

await step("list_file_components_for_code_connect", async () => {
  const { data } = await tool("figma_list_file_components_for_code_connect", { pageId: build.pageId });
  const btn = data.components.find((c) => c.id === build.setId);
  if (!btn) throw new Error("Button set not listed");
  return { count: data.count, name: btn.name, type: btn.type, variants: btn.variants, props: Object.keys(btn.props) };
});

const codeDir = path.join(outDir, "code");
fs.mkdirSync(path.join(codeDir, "components"), { recursive: true });
fs.writeFileSync(
  path.join(codeDir, "components", "Button.tsx"),
  "export interface ButtonProps {\n  size?: 'Small' | 'Large';\n  children: React.ReactNode;\n}\nexport function Button({ size = 'Small', children }: ButtonProps) {\n  return <button className={size}>{children}</button>;\n}\n"
);
fs.writeFileSync(path.join(codeDir, "components", "Card.tsx"), "export function Card() { return <div/>; }\n");

await step("get_code_connect_suggestions", async () => {
  const { data } = await tool("figma_get_code_connect_suggestions", { sourceDir: codeDir, pageId: build.pageId });
  const s = data.suggestions.find((x) => x.figmaId === build.setId);
  if (!s || !s.candidates.length) throw new Error("no candidate for Button");
  return { codeComponents: data.codeComponents, top: s.candidates[0] };
});

await step("add_code_connect_map", async () => {
  const { data } = await tool("figma_add_code_connect_map", {
    nodeId: build.setId,
    componentName: "Button",
    source: "components/Button.tsx",
    framework: "React",
    importPath: "@/components/Button",
    props: { Size: "size", Label: "children" },
  });
  return { target: data.target.name, preview: data.preview };
});

await step("get_code_connect_map for an instance builds a snippet", async () => {
  const { data } = await tool("figma_get_code_connect_map", { nodeId: build.instanceId });
  if (!data.mapped) throw new Error("instance did not resolve to the mapped set");
  return { preview: data.preview, props: Object.keys(data.props) };
});

await step("get_context_for_code_connect returns image plus source file", async () => {
  const { data, images } = await tool("figma_get_context_for_code_connect", { nodeId: build.setId, sourceDir: codeDir });
  if (images[0]) saveImage(images[0], "component.png");
  return { image: !!images[0], sourceFileFound: !!(data.sourceFile && data.sourceFile.code), candidates: (data.candidates || []).length };
});

await step("send_code_connect_mappings reports per item", async () => {
  const { data } = await tool("figma_send_code_connect_mappings", {
    mappings: [
      { nodeId: build.setId, componentName: "Button", source: "components/Button.tsx", importPath: "@/components/Button", props: { Size: "size", Label: "children" } },
      { nodeId: "0:99999", componentName: "Ghost" },
    ],
  });
  return { saved: data.saved, failed: data.failed };
});

await step("get_code_connect_map lists mapped components only", async () => {
  const { data } = await tool("figma_get_code_connect_map", { pageId: build.pageId });
  return { mapped: data.count };
});

// ---- Shaders ----

await step("create_shader with pixel code and effects", async () => {
  const { data, images } = await tool("figma_create_shader", {
    name: "MCP Test Aurora",
    description: "Live check shader",
    pixel: {
      code: "const a = hex(params.colorA), b = hex(params.colorB);\nconst n = fbm(u * params.scale + t, v * params.scale);\nreturn mixColor(a, b, smoothstep(0.25, 0.85, n));",
      width: 840,
      height: 520,
    },
    effects: [{ preset: "shadow", options: { radius: 40, y: 18, opacity: 0.25 } }],
    params: { colorA: "#1B1464", colorB: "#FA4028", scale: 3 },
  });
  if (images[0]) saveImage(images[0], "shader-preview.png");
  return { id: data.created.id, version: data.created.version, preview: !!images[0] };
});

await step("apply_shader to the card", async () => {
  const { data } = await tool("figma_apply_shader", { id: "mcp-test-aurora", nodeIds: [build.cardId] });
  return { applied: data.applied.map((n) => n.name), imageFill: data.imageFill, effects: data.effects };
});

await step("apply built-in glass shader", async () => {
  const { data } = await tool("figma_apply_shader", { id: "glass", nodeIds: [build.glassId] });
  return { applied: data.applied.map((n) => n.name), effects: data.effects };
});

await step("apply built-in film grain on top of the card", async () => {
  const { data } = await tool("figma_apply_shader", { id: "film-grain", nodeIds: [build.cardId], params: { amount: 0.3, size: 1 }, effectsMode: "add" });
  return { applied: data.applied.map((n) => n.name) };
});

await step("list_file_shaders finds the layers", async () => {
  const { data } = await tool("figma_list_file_shaders", { pageId: build.pageId });
  return data.shaders.map((s) => ({ id: s.id, nodes: s.nodes.length, inLibrary: s.inLibrary, libraryVersion: s.libraryVersion, outdated: s.outdatedNodes }));
});

await step("update_shader bumps the version and marks layers outdated", async () => {
  await tool("figma_update_shader", { id: "mcp-test-aurora", params: { colorA: "#003566", colorB: "#FFC300", scale: 5 } });
  const { data } = await tool("figma_list_file_shaders", { pageId: build.pageId });
  const s = data.shaders.find((x) => x.id === "mcp-test-aurora");
  return { libraryVersion: s.libraryVersion, outdatedNodes: s.outdatedNodes };
});

await step("export the shaded card to check it visually", async () => {
  const { data, images } = await tool("figma_export", { nodeId: build.cardId, format: "PNG", scale: 1, savePath: path.join(outDir, "card.png") });
  if (images[0]) saveImage(images[0], "card-returned.png");
  return { bytes: data.bytes, width: data.width, height: data.height };
});

// ---- Generative plugins ----

await step("create and run a generative plugin", async () => {
  await tool("figma_create_generative_plugin", {
    name: "MCP Test Grid",
    description: "Draws a column grid overlay inside a frame",
    code: `
      const page = await figma.getNodeByIdAsync(params.pageId);
      const frame = figma.createFrame();
      frame.name = "Grid " + params.columns + " col";
      frame.resize(params.width, 200);
      frame.x = 0; frame.y = 820;
      frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      page.appendChild(frame);
      const colW = (params.width - params.gutter * (params.columns - 1)) / params.columns;
      for (let i = 0; i < params.columns; i++) {
        const r = figma.createRectangle();
        r.resize(colW, 200);
        r.x = i * (colW + params.gutter);
        r.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.25, b: 0.16 }, opacity: 0.25 }];
        frame.appendChild(r);
      }
      return { frame: frame.id, columns: params.columns };
    `,
    params: { columns: { type: "number", default: 12 }, gutter: { type: "number", default: 16 }, width: { type: "number", default: 960 }, pageId: { type: "string", required: true } },
  });
  const { data } = await tool("figma_run_generative_plugin", { id: "mcp-test-grid", params: { columns: 8, pageId: build.pageId } });
  const after = await tool("figma_get_generative_plugin", { id: "mcp-test-grid" });
  return { params: data.params, result: data.result, runs: after.data.runs };
});

// ---- Video ----

await step("export_video slideshow from a section (mp4)", async () => {
  const { data } = await tool("figma_export_video", { savePath: path.join(outDir, "slides.mp4"), parentId: build.sectionId, frameDurationSeconds: 0.8, scale: 1 }, 300000);
  return data;
});

await step("export_video from explicit frames (gif)", async () => {
  const { data } = await tool("figma_export_video", { savePath: path.join(outDir, "slides.gif"), nodeIds: build.slides, frameDurationSeconds: 0.5, scale: 0.5 }, 300000);
  return data;
});

await step("export_video animated spinner (mp4)", async () => {
  const { data } = await tool(
    "figma_export_video",
    {
      savePath: path.join(outDir, "spinner.mp4"),
      animate: { nodeId: build.spinnerId, code: "node.rotation = -t * 360;", frames: 24, durationSeconds: 1.2 },
      scale: 0.5,
    },
    300000
  );
  return data;
});

await step("animate mode leaves no clones behind", async () => {
  const { data } = await tool("figma_execute", { code: `const page = await figma.getNodeByIdAsync("${build.pageId}"); await page.loadAsync(); return { children: page.children.map(c => c.name) };` });
  const names = data.result.children;
  if (names.filter((n) => n === "Spinner").length !== 1) throw new Error("clone left behind: " + names.join(", "));
  return names;
});

// ---- Cleanup of the mapping test and an overview image ----

await step("remove_code_connect_map", async () => {
  const { data } = await tool("figma_remove_code_connect_map", { nodeId: build.setId });
  const after = await tool("figma_get_code_connect_map", { nodeId: build.setId });
  return { removed: data.removed, mappedAfter: after.data.mapped };
});

await step("overview screenshot of the test page", async () => {
  const { data, images } = await tool("figma_export", { nodeId: build.sectionId, format: "PNG", scale: 0.4 });
  if (images[0]) saveImage(images[0], "slides-section.png");
  const spin = await tool("figma_export", { nodeId: build.spinnerId, format: "PNG", scale: 0.5 });
  if (spin.images[0]) saveImage(spin.images[0], "spinner.png");
  return { section: data.width + "x" + data.height };
});

await step("return Figma to the page it was on", async () => {
  await tool("figma_execute", { code: `const p = await figma.getNodeByIdAsync("${originalPageId}"); await figma.setCurrentPageAsync(p); return p.name;` });
  return { back: true };
});

// Removes only the page this run made. KEEP_TEST_PAGE=1 leaves it for inspection.
if (process.env.KEEP_TEST_PAGE !== "1") {
  await step("delete the test page", async () => {
    const { data } = await tool("figma_execute", {
      code: `const p = await figma.getNodeByIdAsync("${build.pageId}");
        if (!p) return { alreadyGone: true };
        if (p.name !== "MCP test") throw new Error("Refusing to delete a page named " + p.name);
        p.remove();
        return { removed: "${build.pageId}", pages: figma.root.children.map(c => c.name) };`,
    });
    return data.result;
  });
}

const passed = results.filter((r) => r.ok).length;
fs.writeFileSync(path.join(outDir, "live-report.json"), JSON.stringify({ status, build, tools: tools.length, passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} live checks passed. Report: ${path.join(outDir, "live-report.json")}`);
child.kill();
process.exit(passed === results.length ? 0 : 1);
