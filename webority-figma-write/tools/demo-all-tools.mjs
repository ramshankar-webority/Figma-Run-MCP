// Calls every tool of the Webority Figma Write MCP once against the open Figma file and prints
// one line per tool. Builds an "MCP demo" page and leaves it in place for inspection.
//
//   node tools/demo-all-tools.mjs <outDir>
//
// Needs the plugin open in the design editor with "Allow edits" ticked, and port 3692 free.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const outDir = process.argv[2] || path.join(os.tmpdir(), "figma-demo");
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ["server.js"], { cwd: root, env: { ...process.env, FIGMA_WRITE_LIBRARY_DIR: path.join(outDir, "library") }, stdio: ["pipe", "pipe", "pipe"] });
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
async function rpc(method, params, timeoutMs = 300000) {
  const id = ++seq;
  send({ jsonrpc: "2.0", id, method, params });
  const end = Date.now() + timeoutMs;
  while (!replies.has(id)) {
    if (Date.now() > end) throw new Error(`no reply to ${method}`);
    await wait(25);
  }
  const r = replies.get(id);
  if (r.error) throw new Error(r.error.message);
  return r.result;
}
async function raw(name, args = {}, timeoutMs) {
  const r = await rpc("tools/call", { name, arguments: args }, timeoutMs);
  const t = (r.content || []).find((c) => c.type === "text");
  let data = null;
  try {
    data = t ? JSON.parse(t.text) : null;
  } catch {
    data = t.text;
  }
  if (r.isError) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return { data, images: (r.content || []).filter((c) => c.type === "image") };
}

const rows = [];
const used = new Set();
async function show(name, args, pick, opts = {}) {
  used.add(name);
  try {
    const r = await raw(name, args, opts.timeoutMs);
    if (opts.saveImage && r.images[0]) fs.writeFileSync(path.join(outDir, opts.saveImage), Buffer.from(r.images[0].data, "base64"));
    const proof = pick ? pick(r.data, r) : r.data;
    rows.push({ tool: name, ok: true, proof });
    console.log("OK   " + name.padEnd(46) + JSON.stringify(proof).slice(0, 200));
    return r.data;
  } catch (e) {
    rows.push({ tool: name, ok: false, proof: e.message });
    console.log("FAIL " + name.padEnd(46) + e.message.slice(0, 200));
    return null;
  }
}

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "demo", version: "1.1.0" } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
const allTools = (await rpc("tools/list", {})).tools.map((t) => t.name).sort();
console.log(`${allTools.length} tools registered\n`);

let status = null;
for (let i = 0; i < Number(process.env.DEMO_WAIT_SECONDS || 300); i++) {
  status = (await raw("figma_write_status")).data;
  if (status.connected && status.editorType === "figma" && status.editsAllowed) break;
  await wait(1000);
}
if (!(status.connected && status.editsAllowed)) {
  console.log("Plugin not ready: " + JSON.stringify(status));
  child.kill();
  process.exit(1);
}

// 1. status
await show("figma_write_status", {}, (d) => ({ file: d.fileName, page: d.currentPage.name, editor: d.editorType, editsAllowed: d.editsAllowed, plugin: d.version, server: d.server }));
const originalPageId = status.currentPage.id;

// Scratch page and the fixtures the rest of the demo uses.
const setup = await show(
  "figma_execute",
  {
    code: `
      const page = figma.createPage();
      page.name = "MCP demo";
      await figma.setCurrentPageAsync(page);
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      const make = (size) => {
        const c = figma.createComponent();
        c.name = "Size=" + size;
        c.resize(size === "Large" ? 180 : 120, size === "Large" ? 56 : 40);
        c.layoutMode = "HORIZONTAL"; c.primaryAxisAlignItems = "CENTER"; c.counterAxisAlignItems = "CENTER";
        c.cornerRadius = 8; c.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.25, b: 0.16 } }];
        const t = figma.createText(); t.characters = "Button"; t.fontSize = size === "Large" ? 18 : 14;
        t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        c.appendChild(t); return c;
      };
      const set = figma.combineAsVariants([make("Small"), make("Large")], page);
      set.name = "Button"; set.x = 0; set.y = 0;
      const propId = set.addComponentProperty("Label", "TEXT", "Button");
      for (const v of set.children) v.children[0].componentPropertyReferences = { characters: propId };
      const instance = set.defaultVariant.createInstance();
      instance.name = "Buy button"; instance.x = 280; instance.y = 0; page.appendChild(instance);
      const glass = figma.createRectangle();
      glass.name = "Glass card"; glass.resize(220, 140); glass.x = 520; glass.y = 0; glass.cornerRadius = 16;
      glass.fills = [{ type: "SOLID", color: { r: 0.12, g: 0.13, b: 0.2 } }]; page.appendChild(glass);
      const section = figma.createSection();
      section.name = "Slides"; section.x = 0; section.y = 460; section.resizeWithoutConstraints(1000, 300);
      for (let i = 0; i < 3; i++) {
        const f = figma.createFrame(); f.name = "Slide " + (i + 1); f.resize(300, 200);
        f.x = 20 + i * 320; f.y = 510;
        f.fills = [{ type: "SOLID", color: { r: i === 0 ? 0.9 : 0.12, g: i === 1 ? 0.8 : 0.16, b: i === 2 ? 0.9 : 0.22 } }];
        const t = figma.createText(); t.characters = "Slide " + (i + 1); t.fontSize = 32; t.x = 24; t.y = 24;
        t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]; f.appendChild(t);
        section.appendChild(f);
      }
      page.appendChild(section);
      const spinner = figma.createFrame();
      spinner.name = "Spinner"; spinner.resize(200, 200); spinner.x = 800; spinner.y = 0;
      spinner.fills = [{ type: "SOLID", color: { r: 0.07, g: 0.07, b: 0.1 } }];
      const bar = figma.createRectangle(); bar.name = "Bar"; bar.resize(20, 80); bar.x = 90; bar.y = 20; bar.cornerRadius = 10;
      bar.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.25, b: 0.16 } }];
      spinner.appendChild(bar); page.appendChild(spinner);
      figma.currentPage.selection = [instance];
      return { pageId: page.id, setId: set.id, instanceId: instance.id, glassId: glass.id, sectionId: section.id, spinnerId: spinner.id, slides: section.children.map(c => c.id) };
    `,
    timeoutMs: 60000,
  },
  (d) => ({ built: Object.keys(d.result).length + " ids", page: "MCP demo" })
);
const ids = setup.result;

// 3. create_from_spec
const card = await show(
  "figma_create_from_spec",
  {
    parentId: ids.pageId,
    spec: {
      type: "FRAME",
      name: "Shader card",
      x: 0,
      y: 200,
      width: 420,
      height: 220,
      cornerRadius: 20,
      fill: "#141420",
      layout: { mode: "VERTICAL", padding: 28, gap: 10 },
      children: [
        { type: "TEXT", name: "Title", text: { characters: "Aurora", fontSize: 34, color: "#FFFFFF", fontFamily: "Inter", fontStyle: "Regular" } },
        { type: "TEXT", name: "Caption", text: { characters: "placeholder", fontSize: 15, color: "#FFFFFFCC", fontFamily: "Inter", fontStyle: "Regular" } },
      ],
    },
  },
  (d) => ({ created: d.created.name, nodes: d.nodeCount })
);
const cardId = card.created.id;
const captionId = (await raw("figma_execute", { code: `const n = await figma.getNodeByIdAsync("${cardId}"); return n.children.map(c => ({ id: c.id, name: c.name }));` })).data.result.find((c) => c.name === "Caption").id;

// 4. set_text
await show("figma_set_text", { edits: [{ nodeId: captionId, characters: "Rendered by figma_apply_shader" }] }, (d) => ({ updated: d.updated.map((u) => u.name) }));

// 5. selection brief
await show("figma_get_selection_brief", {}, (d) => d.map((n) => ({ name: n.name, type: n.type })));

// ---- Code Connect ----
const codeDir = path.join(outDir, "code", "components");
fs.mkdirSync(codeDir, { recursive: true });
fs.writeFileSync(path.join(codeDir, "Button.tsx"), "export interface ButtonProps {\n  size?: 'Small' | 'Large';\n  children: React.ReactNode;\n}\nexport function Button({ size = 'Small', children }: ButtonProps) {\n  return <button className={size}>{children}</button>;\n}\n");
fs.writeFileSync(path.join(codeDir, "Card.tsx"), "export function Card() { return <div/>; }\n");
const sourceDir = path.join(outDir, "code");

await show("figma_list_file_components_for_code_connect", { pageId: ids.pageId }, (d) => d.components.map((c) => ({ name: c.name, type: c.type, variants: c.variants, props: Object.keys(c.props) })));
await show("figma_get_code_connect_suggestions", { sourceDir, pageId: ids.pageId }, (d) => ({ codeComponents: d.codeComponents, best: d.suggestions[0] && d.suggestions[0].candidates[0] }));
await show("figma_add_code_connect_map", { nodeId: ids.setId, componentName: "Button", source: "components/Button.tsx", framework: "React", importPath: "@/components/Button", props: { Size: "size", Label: "children" } }, (d) => ({ target: d.target.name, preview: d.preview }));
await show("figma_get_code_connect_map", { nodeId: ids.instanceId }, (d) => ({ mapped: d.mapped, preview: d.preview }));
await show("figma_get_context_for_code_connect", { nodeId: ids.setId, sourceDir }, (d) => ({ props: Object.keys(d.props), sourceFile: !!(d.sourceFile && d.sourceFile.code), candidates: (d.candidates || []).length }), { saveImage: "component.png" });
await show("figma_send_code_connect_mappings", { mappings: [{ nodeId: ids.setId, componentName: "Button", source: "components/Button.tsx", importPath: "@/components/Button", props: { Size: "size", Label: "children" } }, { nodeId: "0:99999", componentName: "Ghost" }] }, (d) => ({ saved: d.saved, failed: d.failed }));

// ---- Shaders ----
await show(
  "figma_create_shader",
  {
    name: "Demo Aurora",
    description: "Flowing gradient from layered noise",
    pixel: { code: "const a = hex(params.colorA), b = hex(params.colorB), c = hex(params.colorC);\nconst n = fbm(u * params.scale + t, v * params.scale);\nconst m = fbm(u * params.scale * 0.6 - n, v * params.scale * 0.6 + n);\nreturn mixColor(mixColor(a, b, smoothstep(0.2, 0.8, n)), c, smoothstep(0.4, 0.95, m));", width: 840, height: 440 },
    effects: [{ preset: "shadow", options: { radius: 48, y: 20, opacity: 0.3 } }],
    params: { colorA: "#12123A", colorB: "#FA4028", colorC: "#FFC36B", scale: 3 },
  },
  (d) => ({ id: d.created.id, version: d.created.version, size: d.created.pixel.width + "x" + d.created.pixel.height }),
  { saveImage: "shader-preview.png" }
);
await show("figma_list_shaders", {}, (d) => ({ count: d.count, ids: d.shaders.map((s) => s.id) }));
await show("figma_get_shader", { id: "aurora" }, (d) => ({ id: d.id, builtIn: d.builtIn, params: d.params }), { saveImage: "built-in-aurora.png" });
await show("figma_apply_shader", { id: "demo-aurora", nodeIds: [cardId] }, (d) => ({ applied: d.applied.map((n) => n.name), imageFill: d.imageFill, effects: d.effects }));
await show("figma_apply_shader", { id: "glass", nodeIds: [ids.glassId] }, (d) => ({ applied: d.applied.map((n) => n.name), effects: d.effects }));
await show("figma_apply_shader", { id: "film-grain", nodeIds: [cardId], params: { amount: 0.25 }, effectsMode: "add" }, (d) => ({ applied: d.applied.map((n) => n.name) }));
await show("figma_update_shader", { id: "demo-aurora", params: { colorA: "#003566", colorB: "#FFC300", colorC: "#FF5A1F", scale: 4 } }, (d) => ({ version: d.updated.version, params: d.updated.params }));
await show("figma_list_file_shaders", { pageId: ids.pageId }, (d) => d.shaders.map((s) => ({ id: s.id, layers: s.nodes.length, libraryVersion: s.libraryVersion, outdated: s.outdatedNodes })));

// ---- Generative plugins ----
await show(
  "figma_create_generative_plugin",
  {
    name: "Demo Grid",
    description: "Column grid overlay",
    code: `
      const page = await figma.getNodeByIdAsync(params.pageId);
      const frame = figma.createFrame();
      frame.name = "Grid " + params.columns + " col";
      frame.resize(params.width, 160); frame.x = 0; frame.y = 820;
      frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      page.appendChild(frame);
      const colW = (params.width - params.gutter * (params.columns - 1)) / params.columns;
      for (let i = 0; i < params.columns; i++) {
        const r = figma.createRectangle();
        r.resize(colW, 160); r.x = i * (colW + params.gutter);
        r.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.25, b: 0.16 }, opacity: 0.22 }];
        frame.appendChild(r);
      }
      return { frame: frame.id, columns: params.columns };`,
    params: { columns: { type: "number", default: 12 }, gutter: { type: "number", default: 16 }, width: { type: "number", default: 1000 }, pageId: { type: "string", required: true } },
  },
  (d) => ({ id: d.created.id, params: Object.keys(d.created.params) })
);
await show("figma_list_generative_plugins", {}, (d) => ({ count: d.count, ids: d.plugins.map((p) => p.id) }));
await show("figma_update_generative_plugin", { id: "demo-grid", description: "Column grid overlay for layout checks" }, (d) => ({ version: d.updated.version }));
await show("figma_run_generative_plugin", { id: "demo-grid", params: { columns: 10, pageId: ids.pageId } }, (d) => ({ params: { columns: d.params.columns, gutter: d.params.gutter }, result: d.result }));
await show("figma_get_generative_plugin", { id: "demo-grid" }, (d) => ({ id: d.id, version: d.version, runs: d.runs }));

// ---- Export and video ----
await show("figma_export", { nodeId: cardId, format: "PNG", scale: 1, savePath: path.join(outDir, "card.png") }, (d) => ({ node: d.node.name, size: d.width + "x" + d.height, bytes: d.bytes }), { saveImage: "card-returned.png" });
await show("figma_export_video", { savePath: path.join(outDir, "slides.mp4"), parentId: ids.sectionId, frameDurationSeconds: 0.8 }, (d) => ({ file: path.basename(d.saved), frames: d.frames, seconds: d.durationSeconds, bytes: d.bytes }));
await show("figma_export_video", { savePath: path.join(outDir, "spinner.gif"), animate: { nodeId: ids.spinnerId, code: "node.rotation = -t * 360;", frames: 20, durationSeconds: 1 }, scale: 0.5 }, (d) => ({ file: path.basename(d.saved), frames: d.frames, bytes: d.bytes }));

// Tidy: drop the mapping demo, snapshot the page, go back to the user's page.
await show("figma_remove_code_connect_map", { nodeId: ids.setId }, (d) => ({ removed: d.removed }));
await raw("figma_execute", { code: `const p = await figma.getNodeByIdAsync("${ids.pageId}"); figma.currentPage.selection = []; return p.name;` });
const page = await raw("figma_export", { nodeId: ids.pageId, format: "PNG", scale: 0.4 }).catch(() => null);
if (page && page.images[0]) fs.writeFileSync(path.join(outDir, "page.png"), Buffer.from(page.images[0].data, "base64"));
await raw("figma_execute", { code: `const p = await figma.getNodeByIdAsync("${originalPageId}"); await figma.setCurrentPageAsync(p); return p.name;` });

const missing = allTools.filter((t) => !used.has(t));
const passed = rows.filter((r) => r.ok).length;
fs.writeFileSync(path.join(outDir, "demo-report.json"), JSON.stringify({ tools: allTools.length, calls: rows.length, passed, missing, rows }, null, 2));
console.log(`\n${passed}/${rows.length} calls succeeded across ${used.size}/${allTools.length} tools. Not called: ${missing.join(", ") || "none"}`);
console.log("Artifacts: " + outDir);
child.kill();
process.exit(passed === rows.length && missing.length === 0 ? 0 : 1);
