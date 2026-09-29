// Live check of Figma Draw, Prototype and Motion features through figma_execute, against real Figma.
// Every check runs Plugin API code in the open file and asserts what the API accepts, and also what it
// is known to reject, so a Figma API change shows up here first. Findings behind these checks were
// probed live on 28-Sep-2026.
//
//   node tools/live-check-draw.mjs <outDir>
//
// Needs: the Webority Figma MCP plugin open in the design editor with "Allow edits" ticked. This script
// starts its own server on the first free port; if the panel is paired with another Claude session,
// click Switch in the panel until it shows this run. KEEP_TEST_PAGE=1 keeps the scratch page.
// Shader checks run only when some layer in the file already uses a shader (apply one by hand first);
// otherwise they are reported as skipped.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const outDir = process.argv[2] || path.join(os.tmpdir(), "figma-live-check-draw");
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ["server.js"], { cwd: root, env: { ...process.env }, stdio: ["pipe", "pipe", "pipe"] });
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
  let data = null;
  try {
    data = textPart ? JSON.parse(textPart.text) : null;
  } catch {
    data = textPart.text;
  }
  if (r.isError) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

// Runs a function body inside Figma. The function is serialised, so it may only use `figma`,
// its argument, and the shared prelude below.
const PRELUDE = `
const page = figma.root.children.find(p => p.name === "MCP test · Draw");
if (page) await figma.setCurrentPageAsync(page);
const vec = (d, weight) => { const v = figma.createVector(); figma.currentPage.appendChild(v); v.vectorPaths = [{ windingRule: "NONE", data: d || "M 0 20 C 40 -10 80 50 120 20" }]; v.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]; v.strokeWeight = weight || 8; return v; };
const rejects = async (fn) => { try { await fn(); return false; } catch (e) { return String(e.message || e).replace(/\\s+/g, " ").slice(0, 160); } };
`;
async function figmaRun(fn, arg) {
  const code = `${PRELUDE}\nreturn await (${fn.toString()})(${JSON.stringify(arg ?? null)});`;
  const data = await tool("figma_execute", { code, timeoutMs: 90000 }, 120000);
  return data.result;
}

const results = [];
async function check(name, fn, expect, arg) {
  try {
    const got = await figmaRun(fn, arg);
    const verdict = expect(got);
    if (verdict === "skip") {
      results.push({ name, ok: true, skipped: true, got });
      console.log("SKIP " + name + "  " + JSON.stringify(got).slice(0, 200));
      return got;
    }
    if (verdict !== true) throw new Error(typeof verdict === "string" ? verdict : "unexpected: " + JSON.stringify(got).slice(0, 400));
    results.push({ name, ok: true, got });
    console.log("PASS " + name + "  " + JSON.stringify(got).slice(0, 200));
    return got;
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log("FAIL " + name + "  " + e.message);
    return null;
  }
}

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "live-check-draw", version: "1.0.0" } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });

let status = null;
const waitSeconds = Number(process.env.LIVE_CHECK_WAIT_SECONDS || 600);
for (let i = 0; i < waitSeconds; i++) {
  status = await tool("figma_write_status");
  if (status.connected && status.editorType === "figma" && status.editsAllowed) break;
  if (i === 0) console.log(`Waiting for the plugin (port ${status.port}, session '${status.session}'). Click Switch in the panel if it is paired elsewhere, and tick Allow edits.`);
  await wait(1000);
}
if (!(status.connected && status.editsAllowed)) {
  console.log("FAIL plugin not ready: " + JSON.stringify(status));
  child.kill();
  process.exit(1);
}
console.log("Plugin ready: " + JSON.stringify({ file: status.fileName, page: status.currentPage, port: status.port }));
const originalPageId = status.currentPage.id;

const STRETCH = ["HEIST", "BLOCKBUSTER", "GRINDHOUSE", "BIOPIC", "SPAGHETTI_WESTERN", "SLASHER", "HARDBOILED", "VERITE", "EPIC", "SCREWBALL", "ROM_COM", "NOIR", "PROPAGANDA", "MELODRAMA", "NEW_WAVE"];
const SCATTER = ["BUBBLEGUM", "WITCH_HOUSE", "SHOEGAZE", "HONKY_TONK", "SCREAMO", "DRONE", "DOO_WOP", "SPOKEN_WORD", "VAPORWAVE", "OI"];

await check("create scratch page", async () => {
  const old = figma.root.children.find(p => p.name === "MCP test · Draw");
  if (old) old.remove();
  const p = figma.createPage(); p.name = "MCP test · Draw";
  await figma.setCurrentPageAsync(p);
  return { pageId: p.id };
}, (g) => !!g.pageId);

// ---------------- Draw ----------------

await check("draw: all 15 stretch brushes, both directions", async (names) => {
  const v = vec(); const got = [];
  for (const n of names) { v.complexStrokeProperties = { type: "BRUSH", brushType: "STRETCH", brushName: n }; got.push(v.complexStrokeProperties.brushName); }
  v.complexStrokeProperties = { type: "BRUSH", brushType: "STRETCH", brushName: "NOIR", direction: "BACKWARD" };
  return { got, direction: v.complexStrokeProperties.direction, defaultDirection: (v.complexStrokeProperties = { type: "BRUSH", brushType: "STRETCH", brushName: "NOIR" }, v.complexStrokeProperties.direction) };
}, (g) => g.got.length === STRETCH.length && g.got.every((n, i) => n === STRETCH[i]) && g.direction === "BACKWARD" && g.defaultDirection === "FORWARD", STRETCH);

await check("draw: all 10 scatter brushes and their settings", async (names) => {
  const v = vec(); const got = [];
  for (const n of names) { v.complexStrokeProperties = { type: "BRUSH", brushType: "SCATTER", brushName: n }; got.push(v.complexStrokeProperties.brushName); }
  const defaults = { ...v.complexStrokeProperties };
  v.complexStrokeProperties = { type: "BRUSH", brushType: "SCATTER", brushName: "OI", gap: 0.8, wiggle: 0.5, angularJitter: 30, rotation: 90, sizeJitter: 0.6 };
  return { got, defaults, set: v.complexStrokeProperties };
}, (g) => g.got.length === SCATTER.length && g.defaults.gap === 0.25 && g.defaults.angularJitter === 95 && g.defaults.rotation === 45 && g.set.rotation === 90 && Math.abs(g.set.gap - 0.8) < 1e-6, SCATTER);

await check("draw: loadBrushesAsync for both families", async () => {
  await figma.loadBrushesAsync("STRETCH"); await figma.loadBrushesAsync("SCATTER");
  return { badArg: await rejects(() => figma.loadBrushesAsync(["NOIR"])) };
}, (g) => typeof g.badArg === "string");

await check("draw: pencil wobble (DYNAMIC) defaults", async () => {
  const v = vec(); v.complexStrokeProperties = { type: "DYNAMIC" }; const d = v.complexStrokeProperties;
  v.complexStrokeProperties = { type: "BASIC" };
  return { d, reset: v.complexStrokeProperties.type };
}, (g) => g.d.type === "DYNAMIC" && Math.abs(g.d.frequency - 0.75) < 1e-6 && Math.abs(g.d.smoothen - 0.5) < 1e-6 && g.reset === "BASIC");

await check("draw: variable width presets and custom points", async () => {
  const v = vec(null, 12); const got = [];
  for (const p of ["UNIFORM", "WEDGE", "TAPER", "QUARTER_TAPER", "EYE", "MIRRORED_TAPER"]) { v.variableWidthStrokeProperties = { widthProfile: p }; got.push(v.variableWidthStrokeProperties.widthProfile); }
  v.variableWidthStrokeProperties = { widthProfile: "CUSTOM", variableWidthPoints: [{ position: 0, width: 0.2 }, { position: 0.5, width: 3 }, { position: 1, width: 0.2 }] };
  return { got, custom: v.variableWidthStrokeProperties.variableWidthPoints.length };
}, (g) => g.got.length === 6 && g.custom === 3);

await check("draw: multiple strokes share one weight", async () => {
  const v = vec(); v.strokes = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }, { type: "SOLID", color: { r: 0, g: 0, b: 1 } }];
  return { strokes: v.strokes.length, weight: v.strokeWeight };
}, (g) => g.strokes === 2 && typeof g.weight === "number");

await check("draw: text on a path (lands on the page, not the frame)", async () => {
  const f = figma.createFrame(); figma.currentPage.appendChild(f);
  const v = figma.createVector(); f.appendChild(v); v.vectorPaths = [{ windingRule: "NONE", data: "M 0 40 C 80 0 160 0 240 40" }];
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const tp = figma.createTextPath(v, 0, 0); tp.fontName = { family: "Inter", style: "Regular" }; tp.characters = "Text on a path";
  return { type: tp.type, parent: tp.parent.type, hasStart: "textPathStartData" in tp, noArgs: await rejects(() => figma.createTextPath()) };
}, (g) => g.type === "TEXT_PATH" && g.parent === "PAGE" && g.hasStart && typeof g.noArgs === "string");

await check("draw: noise (3 types), texture, glass, progressive blur", async () => {
  const r = figma.createRectangle(); figma.currentPage.appendChild(r); r.resize(100, 100);
  const set = (e) => { r.effects = [e]; return r.effects[0].type + (r.effects[0].noiseType ? ":" + r.effects[0].noiseType : ""); };
  return [
    set({ type: "NOISE", visible: true, noiseType: "MONOTONE", density: .5, noiseSize: 2, color: { r: 0, g: 0, b: 0, a: .4 } }),
    set({ type: "NOISE", visible: true, noiseType: "DUOTONE", density: .5, noiseSize: 2, color: { r: 0, g: 0, b: 0, a: .4 }, secondaryColor: { r: 1, g: 1, b: 1, a: .4 } }),
    set({ type: "NOISE", visible: true, noiseType: "MULTITONE", density: .5, noiseSize: 2, opacity: .5, color: { r: 0, g: 0, b: 0, a: 1 } }),
    set({ type: "TEXTURE", visible: true, noiseSize: 4, radius: 6, clipToShape: true }),
    set({ type: "GLASS", visible: true, refraction: .8, depth: 20, lightIntensity: .8, lightAngle: -45, dispersion: .4, radius: 4 }),
    set({ type: "LAYER_BLUR", blurType: "PROGRESSIVE", visible: true, radius: 16, startRadius: 0, startOffset: { x: .5, y: 0 }, endOffset: { x: .5, y: 1 } }),
  ];
}, (g) => JSON.stringify(g) === JSON.stringify(["NOISE:MONOTONE", "NOISE:DUOTONE", "NOISE:MULTITONE", "TEXTURE", "GLASS", "LAYER_BLUR"]));

await check("draw: boolean operations and flatten", async () => {
  const pair = () => { const a = figma.createEllipse(); const b = figma.createRectangle(); figma.currentPage.appendChild(a); figma.currentPage.appendChild(b); a.resize(60, 60); b.resize(50, 50); b.x = 30; b.y = 30; return [a, b]; };
  const ops = {}; for (const op of ["union", "subtract", "intersect", "exclude"]) { const n = figma[op](pair(), figma.currentPage); ops[op] = n.booleanOperation; }
  const flat = figma.flatten([figma.subtract(pair(), figma.currentPage)], figma.currentPage);
  return { ops, flat: flat.type };
}, (g) => g.ops.union === "UNION" && g.ops.subtract === "SUBTRACT" && g.ops.intersect === "INTERSECT" && g.ops.exclude === "EXCLUDE" && g.flat === "VECTOR");

await check("draw: outline a brush stroke", async () => {
  const v = vec(); v.complexStrokeProperties = { type: "BRUSH", brushType: "STRETCH", brushName: "NOIR" };
  const o = v.outlineStroke(); return { type: o && o.type };
}, (g) => g.type === "VECTOR");

await check("draw limits: no pattern paint; S path shorthand rejected", async () => {
  const r = figma.createRectangle(); figma.currentPage.appendChild(r);
  return {
    pattern: await rejects(() => { r.fills = [{ type: "PATTERN" }]; }),
    shorthand: await rejects(() => { const v = figma.createVector(); figma.currentPage.appendChild(v); v.vectorPaths = [{ windingRule: "NONE", data: "M 0 0 C 10 10 20 10 30 0 S 50 -10 60 0" }]; }),
  };
}, (g) => typeof g.pattern === "string" && typeof g.shorthand === "string");

// Shaders: code can only reuse a shader a person has applied once by hand.
const shaderSource = await check("draw: find a hand-applied shader in the file", async () => {
  const found = { effect: null, fill: null };
  for (const p of figma.root.children) {
    await p.loadAsync();
    for (const n of p.findAll((n) => "effects" in n || "fills" in n)) {
      const e = "effects" in n ? n.effects.find((x) => x.type === "SHADER") : null;
      const f = Array.isArray(n.fills) ? n.fills.find((x) => x.type === "SHADER") : null;
      if (e && !found.effect) found.effect = e;
      if (f && !found.fill) found.fill = f;
    }
    if (found.effect && found.fill) break;
  }
  return found;
}, (g) => (g.effect || g.fill ? true : "skip"));

await check("draw: reuse the shader effect and fill from code", async (src) => {
  const out = {};
  const r = figma.createRectangle(); figma.currentPage.appendChild(r); r.resize(100, 100);
  if (src.effect) { r.effects = [src.effect]; out.effect = r.effects[0].type; out.effectAsFill = await rejects(() => { r.fills = [{ type: "SHADER", id: src.effect.id }]; }); }
  if (src.fill) { const t = figma.createRectangle(); figma.currentPage.appendChild(t); t.fills = [src.fill]; out.fill = t.fills[0].type; t.fills = [{ type: "SHADER", id: src.fill.id }]; out.fillDefaults = Object.keys(t.fills[0].properties || {}).length; }
  out.importRejected = await rejects(() => figma.importShaderById((src.effect || src.fill).id));
  return out;
}, (g) => (g && (g.effect === "SHADER" || g.fill === "SHADER") && typeof g.importRejected === "string" ? true : (g ? "unexpected: " + JSON.stringify(g) : "skip")), shaderSource || {});

// ---------------- Prototype ----------------

const proto = await check("prototype: build screens, navigate, back, overlay, close, link", async () => {
  const mk = (name, x) => { const f = figma.createFrame(); figma.currentPage.appendChild(f); f.name = name; f.x = x; f.y = 600; f.resize(390, 844); return f; };
  const home = mk("Proto Home", 0), details = mk("Proto Details", 480), sheet = mk("Proto Sheet", 960); sheet.resize(390, 360);
  const btn = (parent) => { const b = figma.createFrame(); parent.appendChild(b); b.resize(200, 48); return b; };
  const a = btn(home), b = btn(details), c = btn(home), d = btn(sheet), e = btn(home);
  await a.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: details.id, navigation: "NAVIGATE", transition: { type: "SMART_ANIMATE", easing: { type: "EASE_IN_AND_OUT" }, duration: 0.4 }, preserveScrollPosition: false }] }]);
  await b.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "BACK" }] }]);
  await c.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: sheet.id, navigation: "OVERLAY", transition: { type: "MOVE_IN", direction: "TOP", matchLayers: false, easing: { type: "EASE_OUT" }, duration: 0.3 } }] }]);
  await d.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "CLOSE" }] }]);
  await e.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "URL", url: "https://webority.com", openInNewTab: true }, { type: "BACK" }] }]);
  return { home: home.id, details: details.id, sheet: sheet.id, probe: a.id, kinds: [a, b, c, d, e].map((n) => n.reactions[0].actions.map((x) => x.navigation || x.type).join("+")), flows: figma.currentPage.flowStartingPoints.length };
}, (g) => JSON.stringify(g.kinds) === JSON.stringify(["NAVIGATE", "BACK", "OVERLAY", "CLOSE", "URL+BACK"]) && g.flows >= 1);

await check("prototype: triggers", async (ids) => {
  const src = await figma.getNodeByIdAsync(ids.probe); const ok = [];
  const trig = async (trigger) => { await src.setReactionsAsync([{ trigger, actions: [{ type: "BACK" }] }]); ok.push(trigger.type); };
  for (const t of ["ON_CLICK", "ON_MEDIA_END"]) await trig({ type: t });
  for (const t of ["MOUSE_ENTER", "MOUSE_LEAVE", "MOUSE_UP", "MOUSE_DOWN"]) await trig({ type: t, delay: 0.2 });
  await trig({ type: "AFTER_TIMEOUT", timeout: 2 });
  await trig({ type: "ON_KEY_DOWN", device: "KEYBOARD", keyCodes: [13] });
  const hoverBack = await rejects(() => src.setReactionsAsync([{ trigger: { type: "ON_HOVER" }, actions: [{ type: "BACK" }] }]));
  await src.setReactionsAsync([{ trigger: { type: "ON_DRAG" }, actions: [{ type: "NODE", destinationId: ids.details, navigation: "NAVIGATE", transition: { type: "SMART_ANIMATE", easing: { type: "EASE_OUT" }, duration: 0.3 } }] }]); ok.push("ON_DRAG");
  return { ok, hoverBack };
}, (g) => g.ok.length === 9 && typeof g.hoverBack === "string", proto || {});

await check("prototype: every transition and direction", async (ids) => {
  const src = await figma.getNodeByIdAsync(ids.probe); let n = 0;
  const nav = (tr) => src.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: ids.details, navigation: "NAVIGATE", transition: tr }] }]);
  await nav(null); n++;
  for (const t of ["DISSOLVE", "SMART_ANIMATE"]) { await nav({ type: t, easing: { type: "EASE_OUT" }, duration: 0.3 }); n++; }
  for (const t of ["MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"]) for (const dir of ["LEFT", "RIGHT", "TOP", "BOTTOM"]) { await nav({ type: t, direction: dir, matchLayers: true, easing: { type: "EASE_OUT" }, duration: 0.3 }); n++; }
  return { n };
}, (g) => g.n === 23, proto || {});

await check("prototype: every easing, bezier and spring", async (ids) => {
  const src = await figma.getNodeByIdAsync(ids.probe); let n = 0;
  const nav = (easing) => src.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: ids.details, navigation: "NAVIGATE", transition: { type: "DISSOLVE", easing, duration: 0.3 } }] }]);
  for (const e of ["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT", "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK", "GENTLE", "QUICK", "BOUNCY", "SLOW"]) { await nav({ type: e }); n++; }
  await nav({ type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: .2, y1: .8, x2: .2, y2: 1 } }); n++;
  await nav({ type: "CUSTOM_SPRING", easingFunctionSpring: { mass: 1, stiffness: 200, damping: 15 } }); n++;
  const springVelocity = await rejects(() => nav({ type: "CUSTOM_SPRING", easingFunctionSpring: { mass: 1, stiffness: 200, damping: 15, initialVelocity: 0 } }));
  return { n, springVelocity };
}, (g) => g.n === 13 && typeof g.springVelocity === "string", proto || {});

await check("prototype: interactive component (hover, press)", async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const mk = (s) => { const c = figma.createComponent(); figma.currentPage.appendChild(c); c.name = "State=" + s; c.resize(120, 40); return c; };
  const [d, h, p] = [mk("Default"), mk("Hover"), mk("Pressed")];
  figma.combineAsVariants([d, h, p], figma.currentPage);
  await d.setReactionsAsync([{ trigger: { type: "ON_HOVER" }, actions: [{ type: "NODE", destinationId: h.id, navigation: "CHANGE_TO", transition: { type: "SMART_ANIMATE", easing: { type: "EASE_OUT" }, duration: 0.15 } }] }]);
  await h.setReactionsAsync([{ trigger: { type: "ON_PRESS" }, actions: [{ type: "NODE", destinationId: p.id, navigation: "CHANGE_TO", transition: { type: "SMART_ANIMATE", easing: { type: "EASE_OUT" }, duration: 0.1 } }] }]);
  return [d.reactions[0].trigger.type, h.reactions[0].trigger.type];
}, (g) => g[0] === "ON_HOVER" && g[1] === "ON_PRESS");

await check("prototype: scrolling, fixed layers, scroll-to", async (ids) => {
  const f = await figma.getNodeByIdAsync(ids.details); f.resize(390, 1800); f.overflowDirection = "VERTICAL";
  const target = figma.createFrame(); f.appendChild(target); target.y = 1400;
  const jump = figma.createFrame(); f.appendChild(jump); jump.y = 160;
  // Fixed layers are the topmost N children, so the header goes on top, then the count is set.
  const hdr = figma.createFrame(); f.appendChild(hdr); hdr.resize(390, 64); f.numberOfFixedChildren = 1;
  await jump.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: target.id, navigation: "SCROLL_TO", transition: { type: "SCROLL_ANIMATE", easing: { type: "EASE_IN_AND_OUT" }, duration: 0.6 } }] }]);
  return { overflow: f.overflowDirection, fixed: f.numberOfFixedChildren, nav: jump.reactions[0].actions[0].navigation, sticky: await rejects(() => { jump.scrollBehavior = "STICKY_SCROLLS"; }) };
}, (g) => g.overflow === "VERTICAL" && g.fixed === 1 && g.nav === "SCROLL_TO" && typeof g.sticky === "string", proto || {});

await check("prototype: variables, set, conditional, mode switch, bound visibility", async (ids) => {
  const coll = figma.variables.createVariableCollection("MCP test · Proto state");
  const liked = figma.variables.createVariable("liked", coll, "BOOLEAN"); liked.setValueForMode(coll.modes[0].modeId, false);
  const dark = coll.addMode("Dark");
  const src = await figma.getNodeByIdAsync(ids.probe);
  await src.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [
    { type: "SET_VARIABLE", variableId: liked.id, variableValue: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true } },
    { type: "CONDITIONAL", conditionalBlocks: [{ condition: { type: "EXPRESSION", resolvedType: "BOOLEAN", value: { expressionFunction: "EQUALS", expressionArguments: [{ type: "VARIABLE_ALIAS", resolvedType: "BOOLEAN", value: { type: "VARIABLE_ALIAS", id: liked.id } }, { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true }] } }, actions: [{ type: "BACK" }] }, { actions: [{ type: "CLOSE" }] }] },
    { type: "SET_VARIABLE_MODE", variableCollectionId: coll.id, variableModeId: dark }] }]);
  src.setBoundVariable("visible", liked);
  return { actions: src.reactions[0].actions.map((a) => a.type), bound: !!src.boundVariables.visible, collectionId: coll.id };
}, (g) => JSON.stringify(g.actions) === JSON.stringify(["SET_VARIABLE", "CONDITIONAL", "SET_VARIABLE_MODE"]) && g.bound, proto || {});

await check("prototype: flows; overlay settings stay read-only", async (ids) => {
  figma.currentPage.flowStartingPoints = [{ nodeId: ids.home, name: "Onboarding" }, { nodeId: ids.details, name: "Deep link" }];
  const sheet = await figma.getNodeByIdAsync(ids.sheet);
  return { flows: figma.currentPage.flowStartingPoints.map((f) => f.name), overlayWrite: await rejects(() => { sheet.overlayBackground = { type: "SOLID_COLOR", color: { r: 0, g: 0, b: 0, a: .4 } }; }) };
}, (g) => g.flows.join() === "Onboarding,Deep link" && typeof g.overlayWrite === "string", proto || {});

// ---------------- Motion ----------------

await check("motion: the 6 animation presets", async () => {
  const s = await figma.motion.figmaAnimationStyles();
  return s.map((x) => x.styleId);
}, (g) => JSON.stringify(g) === JSON.stringify(["Position", "Scale", "Rotation", "Size", "Opacity", "Path"]));

await check("motion: apply every preset with custom settings", async () => {
  const f = figma.createFrame(); figma.currentPage.appendChild(f); f.name = "Motion test"; f.x = 0; f.y = 1600; f.resize(800, 300);
  const box = () => { const r = figma.createRectangle(); f.appendChild(r); r.resize(60, 60); return r; };
  const path = figma.createVector(); f.appendChild(path); path.vectorPaths = [{ windingRule: "NONE", data: "M 0 20 C 40 -10 80 50 120 20" }]; path.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  const apply = (n, id, props) => { n.applyAnimationStyle(id, { type: "FIGMA", props }); return n.animationStyles[0].props; };
  const out = {
    Position: apply(box(), "Position", { type: "slide_in", direction: "bottom", distance: 120, duration: 0.8 }).direction,
    Scale: apply(box(), "Scale", { type: "scaleIn", amount: 40 }).amount,
    Rotation: apply(box(), "Rotation", { type: "rotateIn", direction: "counterClockwise", amount: 270 }).amount,
    Size: apply(box(), "Size", { type: "resize_in", amount: 30, axis: "x" }).axis,
    Opacity: apply(box(), "Opacity", { type: "fadeIn", delay: 0.8 }).type,
    Path: apply(path, "Path", { type: "draw", direction: "forward" }).type,
  };
  out.bareProps = await rejects(() => box().applyAnimationStyle("Scale", { type: "scaleIn" }));
  out.frameId = f.id;
  return out;
}, (g) => g.Position === "bottom" && g.Scale === 40 && g.Rotation === 270 && g.Size === "x" && g.Opacity === "fadeIn" && g.Path === "draw" && typeof g.bareProps === "string");

await check("motion: manual keyframe tracks (float, vector, colour, effect, easing)", async () => {
  const f = figma.currentPage.findOne((n) => n.name === "Motion test");
  const r = figma.createRectangle(); f.appendChild(r); r.resize(60, 60); r.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 1 } }]; r.effects = [{ type: "LAYER_BLUR", visible: true, radius: 0 }];
  const fl = (v) => ({ type: "FLOAT", value: v });
  r.applyManualKeyframeTrack({ type: "PROPERTY", name: "ROTATION" }, { keyframes: [{ timelinePosition: 0, value: fl(0) }, { timelinePosition: 1, value: fl(90), easing: { type: "BOUNCY" } }] });
  r.applyManualKeyframeTrack({ type: "PROPERTY", name: "SCALE_XY" }, { keyframes: [{ timelinePosition: 0, value: { type: "VECTOR", value: { x: 1, y: 1 } } }, { timelinePosition: 1, value: { type: "VECTOR", value: { x: 1.4, y: 1.4 } } }] });
  r.applyManualKeyframeTrack({ type: "INDEXED_ITEM", collection: "fills", index: 0 }, { keyframes: [{ timelinePosition: 0, value: { type: "COLOR", value: { r: 0, g: 0, b: 1, a: 1 } } }, { timelinePosition: 2, value: { type: "COLOR", value: { r: 1, g: 0, b: 0, a: 1 } } }] });
  r.applyManualKeyframeTrack({ type: "INDEXED_ITEM", collection: "effects", index: 0, field: "RADIUS" }, { keyframes: [{ timelinePosition: 0, value: fl(20) }, { timelinePosition: 1.5, value: fl(0) }] });
  const floatForVector = await rejects(() => r.applyManualKeyframeTrack({ type: "PROPERTY", name: "TRANSLATION_XY" }, { keyframes: [{ timelinePosition: 0, value: fl(0) }] }));
  return { tracks: Object.keys(r.manualKeyframeTracks).length, floatForVector };
}, (g) => g.tracks === 4 && typeof g.floatForVector === "string");

await check("motion: timeline length; playhead stays read-only", async () => {
  const f = figma.currentPage.findOne((n) => n.name === "Motion test");
  f.setTimelineDuration(f.timelines[0].id, 3);
  return { duration: f.timelines[0].duration, playhead: await rejects(() => { figma.motion.playheadPosition = 1; }) };
}, (g) => g.duration === 3 && typeof g.playhead === "string");

// ---------------- The three MCP tools (1.6.0), end to end ----------------

const toolNames = (await rpc("tools/list", {})).tools.map((t) => t.name);
async function toolCheck(name, fn) {
  try {
    const got = await fn();
    results.push({ name, ok: true, got });
    console.log("PASS " + name + "  " + JSON.stringify(got).slice(0, 200));
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log("FAIL " + name + "  " + e.message);
  }
}
if (!toolNames.includes("figma_draw_style")) {
  results.push({ name: "tools: figma_draw_style / set_prototype / set_motion", ok: true, skipped: true, got: "server older than 1.6.0" });
  console.log("SKIP tools: server has no figma_draw_style (older than 1.6.0)");
} else {
  const ids = await figmaRun(async () => {
    const f = figma.createFrame(); figma.currentPage.appendChild(f); f.name = "Tools test"; f.x = 0; f.y = 2200; f.resize(600, 400);
    const v = figma.createVector(); f.appendChild(v); v.vectorPaths = [{ windingRule: "NONE", data: "M 0 20 C 40 -10 80 50 120 20" }]; v.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]; v.strokeWeight = 8;
    const v2 = figma.createVector(); f.appendChild(v2); v2.vectorPaths = [{ windingRule: "NONE", data: "M 0 40 C 80 0 160 0 240 40" }]; v2.y = 100;
    const a = figma.createEllipse(); f.appendChild(a); a.resize(60, 60); a.x = 300;
    const b = figma.createRectangle(); f.appendChild(b); b.resize(50, 50); b.x = 330; b.y = 30;
    const box = figma.createRectangle(); f.appendChild(box); box.resize(60, 60); box.y = 250; box.effects = [{ type: "LAYER_BLUR", visible: true, radius: 0 }];
    const screen2 = figma.createFrame(); figma.currentPage.appendChild(screen2); screen2.name = "Tools test 2"; screen2.x = 700; screen2.y = 2200;
    return { frame: f.id, v: v.id, v2: v2.id, a: a.id, b: b.id, box: box.id, screen2: screen2.id };
  });
  await toolCheck("tool figma_draw_style: brush, width, effects", async () => {
    const r = await tool("figma_draw_style", { nodeIds: [ids.v], stroke: { brush: { type: "SCATTER", name: "SHOEGAZE", gap: 0.6 }, width: { profile: "TAPER" }, color: "#c62a2a" }, effects: [{ type: "noise", noiseType: "DUOTONE" }, { type: "texture" }] });
    if (r.errors.length || r.styled[0].stroke.brushName !== "SHOEGAZE" || r.styled[0].effects.join() !== "NOISE,TEXTURE") throw new Error(JSON.stringify(r));
    return r.styled[0].stroke;
  });
  await toolCheck("tool figma_draw_style: pencil wobble, then back to basic", async () => {
    const r1 = await tool("figma_draw_style", { nodeIds: [ids.v], stroke: { dynamic: { wiggle: 0.6 } } });
    const r2 = await tool("figma_draw_style", { nodeIds: [ids.v], stroke: { basic: true } });
    if (r1.styled[0].stroke.type !== "DYNAMIC" || r2.styled[0].stroke.type !== "BASIC") throw new Error(JSON.stringify([r1, r2]));
    return [r1.styled[0].stroke.type, r2.styled[0].stroke.type];
  });
  await toolCheck("tool figma_draw_style: text on a path stays in its frame", async () => {
    const r = await tool("figma_draw_style", { nodeIds: [ids.v2], textPath: { text: "Along the curve", fontSize: 16 } });
    if (r.created.type !== "TEXT_PATH" || r.created.parent.id !== ids.frame) throw new Error(JSON.stringify(r));
    return r.created;
  });
  await toolCheck("tool figma_draw_style: subtract with a fill", async () => {
    const r = await tool("figma_draw_style", { nodeIds: [ids.a, ids.b], boolean: { op: "subtract", fill: "#2f50e4", name: "Bite" } });
    if (r.created.type !== "BOOLEAN_OPERATION") throw new Error(JSON.stringify(r));
    return r.created;
  });
  await toolCheck("tool figma_set_prototype: link, flow, scroll, hover error hint", async () => {
    const r = await tool("figma_set_prototype", {
      links: [
        { sourceId: ids.box, actions: [{ type: "navigate", destinationId: ids.screen2 }], transition: { type: "PUSH", direction: "LEFT", easing: { spring: { mass: 1, stiffness: 200, damping: 15 } } } },
        { sourceId: ids.a, trigger: "ON_HOVER", actions: [{ type: "back" }] },
      ],
      flows: [{ nodeId: ids.frame, name: "Tools flow" }],
      scroll: [{ frameId: ids.frame, overflow: "VERTICAL", fixedChildren: 1 }],
    });
    if (r.linked.length !== 1 || r.linked[0].actions[0] !== "NAVIGATE" || r.scroll[0].overflow !== "VERTICAL" || r.flows[0].name !== "Tools flow") throw new Error(JSON.stringify(r));
    if (!(r.errors[0] && /change_to/.test(r.errors[0].error))) throw new Error("hover + back should fail with a hint: " + JSON.stringify(r.errors));
    return { linked: r.linked[0], hoverHint: true };
  });
  await toolCheck("tool figma_set_motion: presets list, preset, keyframes, timeline", async () => {
    const list = await tool("figma_set_motion", { listPresets: true });
    const r = await tool("figma_set_motion", {
      nodeIds: [ids.box],
      presets: [{ preset: "Scale", settings: { type: "scaleIn", amount: 40, easing: "BOUNCY" } }],
      keyframes: [
        { property: "ROTATION", keys: [{ time: 0, value: 0 }, { time: 1, value: 180, easing: { bezier: [0.2, 0.8, 0.2, 1] } }] },
        { property: "SCALE_XY", keys: [{ time: 0, value: 1 }, { time: 1, value: { x: 1.3, y: 1.3 } }] },
        { fillIndex: 0, keys: [{ time: 0, value: "#2f50e4" }, { time: 2, value: "#c62a2a" }] },
        { effect: { index: 0, field: "RADIUS" }, keys: [{ time: 0, value: 12 }, { time: 1, value: 0 }] },
      ],
      timelineSeconds: 4,
    });
    if (list.length !== 6 || r.errors.length || r.animated[0].tracks.length !== 4 || r.animated[0].presets[0] !== "Scale" || r.timelines[0].duration !== 4) throw new Error(JSON.stringify(r));
    // Read back in a later call: manualKeyframeTracks is stale inside the call that set it.
    const stored = await figmaRun(async (id) => { const n = await figma.getNodeByIdAsync(id); return { tracks: Object.keys(n.manualKeyframeTracks).length, presets: n.animationStyles.length }; }, ids.box);
    if (stored.tracks !== 4 || stored.presets !== 1) throw new Error("stored: " + JSON.stringify(stored));
    await tool("figma_set_motion", { nodeIds: [ids.box], clear: true });
    const after = await figmaRun(async (id) => { const n = await figma.getNodeByIdAsync(id); return { tracks: Object.keys(n.manualKeyframeTracks).length, presets: n.animationStyles.length }; }, ids.box);
    if (after.tracks || after.presets) throw new Error("clear left motion: " + JSON.stringify(after));
    return { presets: list.map((x) => x.preset), tracks: r.animated[0].tracks };
  });
}

// ---------------- Cleanup ----------------

await check("return Figma to the page it was on", async (id) => {
  const p = await figma.getNodeByIdAsync(id); await figma.setCurrentPageAsync(p); return p.name;
}, (g) => typeof g === "string", originalPageId);

if (process.env.KEEP_TEST_PAGE !== "1") {
  await check("delete the scratch page and test variables", async (backId) => {
    const p = figma.root.children.find((x) => x.name === "MCP test · Draw");
    // A page cannot be removed while it is current; move off it in this same call.
    if (p && figma.currentPage === p) await figma.setCurrentPageAsync((await figma.getNodeByIdAsync(backId)) || figma.root.children.find((x) => x !== p));
    if (p) p.remove();
    const colls = (await figma.variables.getLocalVariableCollectionsAsync()).filter((c) => c.name === "MCP test · Proto state");
    colls.forEach((c) => c.remove());
    return { pageRemoved: !!p, collectionsRemoved: colls.length };
  }, (g) => g.pageRemoved, originalPageId);
}

const passed = results.filter((r) => r.ok).length;
const skipped = results.filter((r) => r.skipped).length;
fs.writeFileSync(path.join(outDir, "live-draw-report.json"), JSON.stringify({ file: status.fileName, passed, skipped, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} live checks passed${skipped ? ` (${skipped} skipped)` : ""}. Report: ${path.join(outDir, "live-draw-report.json")}`);
child.kill();
process.exit(passed === results.length ? 0 : 1);
