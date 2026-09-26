// Automated checks without Figma: a fake plugin exercises the real bridge, then the real MCP
// server is spawned over stdio to confirm it starts and advertises its tools.
// Run: npm test (Webority Figma Write MCP v1.1.0)

import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import WebSocket from "ws";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { FigmaWriteBridge, CLOSE_BAD_TOKEN, CLOSE_REPLACED, hmac } from "./bridge.js";
import { encodePng, pngSize } from "./lib/png.js";
import { BUILT_IN_SHADERS, renderPixelShader } from "./lib/shaders.js";
import { scanComponents, suggestMappings, addLayaPicks } from "./lib/code-scan.js";
import { reviewTree, contrast } from "./lib/design-review.js";
import { COLOR_TOKENS, resolveColor, resolveSpecColors, isTokenColor } from "./lib/color-tokens.js";
import http from "node:http";

// Paths resolve from this file, so npm test works from any folder.
const here = path.dirname(fileURLToPath(import.meta.url));
// The spawned server gets its own token file, so tests never read or create the real one.
const TEST_TOKEN_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wfw-token-")), "bridge-token");
const SERVER_VERSION = fs.readFileSync(path.join(here, "server.js"), "utf8").match(/export const VERSION = "([^"]+)"/)[1];

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
  }
}

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function openSocket(port, { origin = "null", host, token } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    if (host) headers.Host = host;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin, headers });
    const outcome = { ws, opened: false, closeCode: null, httpStatus: null };
    ws.on("open", () => {
      outcome.opened = true;
      if (token === undefined) return resolve(outcome);
      // Same handshake as plugin/ui.template.html: check the bridge's proof, then answer its nonce.
      const nonce = crypto.randomBytes(32).toString("hex");
      ws.once("message", (data) => {
        const m = JSON.parse(String(data));
        outcome.bridgeProved = m.type === "auth-challenge" && m.proof === hmac(token, "server|" + nonce);
        ws.send(JSON.stringify({ auth: hmac(token, "plugin|" + m.nonce) }));
        resolve(outcome);
      });
      ws.send(JSON.stringify({ hello: true, nonce }));
    });
    ws.on("unexpected-response", (_req, res) => {
      outcome.httpStatus = res.statusCode;
      resolve(outcome);
    });
    ws.on("error", () => resolve(outcome));
    ws.on("close", (code) => (outcome.closeCode = code));
  });
}

// Answers {id, command, params} like plugin/code.js does.
function fakePlugin(ws, fileName) {
  ws.on("message", (data) => {
    const msg = JSON.parse(String(data));
    if (msg.command === "boom") ws.send(JSON.stringify({ id: msg.id, error: "simulated failure" }));
    else ws.send(JSON.stringify({ id: msg.id, result: { echo: msg.command, params: msg.params, fileName } }));
  });
  ws.send(JSON.stringify({ type: "state", state: { fileName, editsAllowed: true } }));
}

const TOKEN = "a".repeat(64);
const port = await freePort();
const bridge = new FigmaWriteBridge({ port, token: TOKEN });
assert.equal(await bridge.start(), true);

await test("rejects a foreign Host header (DNS rebinding)", async () => {
  const o = await openSocket(port, { host: `evil.example:${port}`, token: TOKEN });
  assert.equal(o.opened, false);
  assert.equal(o.httpStatus, 421);
});

await test("rejects a web page Origin", async () => {
  const o = await openSocket(port, { origin: "https://evil.example", token: TOKEN });
  assert.equal(o.opened, false);
  assert.equal(o.httpStatus, 403);
});

await test("closes a socket with the wrong token", async () => {
  const o = await openSocket(port, { token: "b".repeat(64) });
  await wait(200);
  assert.equal(o.closeCode, CLOSE_BAD_TOKEN);
  assert.equal(bridge.status().connected, false);
});

await test("bridge proves it knows the token, and a plain-token hello is refused", async () => {
  const good = await openSocket(port, { token: TOKEN });
  assert.equal(good.bridgeProved, true);
  good.ws.close();
  // The old handshake sent the token itself; a squatter would have learned it. It must not work.
  const legacy = await openSocket(port, {});
  legacy.ws.send(JSON.stringify({ hello: true, token: TOKEN }));
  await wait(200);
  assert.equal(legacy.closeCode, CLOSE_BAD_TOKEN);
  await wait(100);
  assert.equal(bridge.status().connected, false);
});

await test("request without a plugin fails with guidance", async () => {
  await assert.rejects(bridge.request("status", {}, 1000), /No Figma plugin connected/);
});

let first;
await test("authenticated plugin round-trips a command", async () => {
  first = await openSocket(port, { token: TOKEN });
  fakePlugin(first.ws, "File A");
  await wait(150);
  assert.equal(bridge.status().connected, true);
  assert.equal(bridge.status().fileName, "File A");
  const r = await bridge.request("execute", { code: "return 1" }, 2000);
  assert.equal(r.echo, "execute");
  assert.equal(r.params.code, "return 1");
});

await test("plugin errors surface as rejections", async () => {
  await assert.rejects(bridge.request("boom", {}, 2000), /simulated failure/);
});

await test("a second plugin window replaces the first (4000) and gets the traffic", async () => {
  const second = await openSocket(port, { token: TOKEN });
  fakePlugin(second.ws, "File B");
  await wait(200);
  assert.equal(first.closeCode, CLOSE_REPLACED);
  const r = await bridge.request("status", {}, 2000);
  assert.equal(r.fileName, "File B");
  second.ws.close();
  await wait(100);
  assert.equal(bridge.status().connected, false);
});

await test("plain HTTP gets no API (404)", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/rpc`, { method: "POST", body: "{}" });
  assert.equal(res.status, 404);
});

await test("second bridge on a busy port reports it clearly", async () => {
  const rival = new FigmaWriteBridge({ port, token: TOKEN });
  assert.equal(await rival.start(), false);
  assert.match(rival.bindError, /already in use/);
});

await bridge.stop();

// ---- 1.1.0 library units (no Figma, no server) ----

await test("pixel shader renders a PNG of the requested size", async () => {
  const png = renderPixelShader({ code: "return [u, v, 0.5];", width: 33, height: 17 });
  assert.deepEqual(pngSize(png), { width: 33, height: 17 });
});

await test("pixel shader reports a bad return value and a runaway loop", async () => {
  assert.throws(() => renderPixelShader({ code: "return 5;", width: 4, height: 4 }), /must return \[r, g, b\]/);
  assert.throws(() => renderPixelShader({ code: "while(true){}", width: 2, height: 2, timeoutMs: 300 }), /timed out/);
  assert.throws(() => renderPixelShader({ code: "return [0,0,0];", width: 5000, height: 2 }), /1-4096/);
});

await test("built-in pixel shaders render", async () => {
  for (const s of BUILT_IN_SHADERS.filter((x) => x.pixel)) {
    const png = renderPixelShader({ code: s.pixel.code, width: 64, height: 64, params: s.params });
    assert.equal(pngSize(png).width, 64, s.id);
  }
});

await test("token lives outside the install folder, and an old one is moved there", async () => {
  const { ensureToken, tokenPath } = await import("./lib/token.js");
  const install = fs.mkdtempSync(path.join(os.tmpdir(), "wfw-install-"));
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wfw-profile-")), "sub", "bridge-token");
  fs.writeFileSync(path.join(install, ".bridge-token"), "c".repeat(64));
  assert.equal(ensureToken({ legacyDir: install, file: target }), "c".repeat(64));
  assert.equal(fs.existsSync(path.join(install, ".bridge-token")), false);
  assert.equal(ensureToken({ legacyDir: install, file: target }), "c".repeat(64));
  // Through the environment override (how the test server runs), the legacy token is left alone.
  fs.writeFileSync(path.join(install, ".bridge-token"), "d".repeat(64));
  const saved = process.env.FIGMA_WRITE_TOKEN_FILE;
  process.env.FIGMA_WRITE_TOKEN_FILE = target + "-env";
  try {
    assert.equal(tokenPath(), target + "-env");
    assert.notEqual(ensureToken({ legacyDir: install }), "d".repeat(64));
    assert.equal(fs.existsSync(path.join(install, ".bridge-token")), true);
  } finally {
    if (saved === undefined) delete process.env.FIGMA_WRITE_TOKEN_FILE;
    else process.env.FIGMA_WRITE_TOKEN_FILE = saved;
  }
  assert.ok(tokenPath({ LOCALAPPDATA: "X:/L", XDG_CONFIG_HOME: "/x" }).endsWith(path.join("webority-figma-mcp", "bridge-token")));
});

await test("code scan finds components and suggests matches with confidence", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfw-scan-"));
  fs.mkdirSync(path.join(dir, "components"));
  fs.mkdirSync(path.join(dir, "node_modules", "junk"), { recursive: true });
  fs.writeFileSync(path.join(dir, "components", "Button.tsx"), "export interface ButtonProps {\n  size?: string;\n  variant: string;\n}\nexport function Button(p: ButtonProps) { return <button/>; }\n");
  fs.writeFileSync(path.join(dir, "components", "Avatar.vue"), "<template><img/></template>");
  fs.writeFileSync(path.join(dir, "node_modules", "junk", "Button.tsx"), "export function Button() {}");
  const scan = scanComponents(dir);
  assert.deepEqual(scan.components.map((c) => c.name).sort(), ["Avatar", "Button"]);
  assert.deepEqual(scan.components.find((c) => c.name === "Button").props, ["size", "variant"]);
  const s = suggestMappings([{ id: "1:1", name: "Buttons/Button", props: { Size: {}, Variant: {} } }, { id: "1:2", name: "Chip" }], scan.components);
  assert.equal(s[0].candidates[0].componentName, "Button");
  assert.equal(s[0].candidates[0].confidence, 1);
  assert.equal(s[0].candidates[0].propMatch.find((p) => p.figma === "Size").code, "size");
  assert.equal(s[1].candidates.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

await test("Laya is off without its URL, and when on adds its pick only where names are unsure", async () => {
  const codes = [
    { name: "Button", file: "ui/Button.tsx", framework: "React", props: ["variant"] },
    { name: "Switch", file: "ui/Switch.tsx", framework: "React", props: ["value"] },
  ];
  const figma = [{ id: "1:1", name: "Button", props: {} }, { id: "1:2", name: "Toggle", props: {} }];
  const saved = process.env.FIGMA_WRITE_LAYA_URL;
  delete process.env.FIGMA_WRITE_LAYA_URL;
  try {
    const off = suggestMappings(figma, codes);
    assert.deepEqual(await addLayaPicks(off, figma, codes), { used: false });
    assert.equal(off[1].candidates.length, 0);

    // A fake laya-serve: answers every choice with "Switch" and records what it was asked.
    const asked = [];
    const srv = http.createServer((req, res) => {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        const b = JSON.parse(body);
        asked.push({ url: req.url, state: b.state, options: Object.keys(b.questions.match.criteria) });
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ answers: { match: { choice: "Switch", confidence: 0.61 } } }));
      });
    });
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const on = suggestMappings(figma, codes);
    const r = await addLayaPicks(on, figma, codes, `http://127.0.0.1:${srv.address().port}/`);
    srv.close();
    assert.deepEqual(r, { used: true, asked: 1, skipped: 0, sureByName: 1 });
    assert.equal(asked.length, 1, "Button matched by name, so only Toggle goes to Laya");
    assert.equal(asked[0].url, "/v1/systemone");
    assert.equal(asked[0].state.figma_component, "Toggle");
    assert.deepEqual(asked[0].options, ["Button", "Switch"]);
    assert.equal(on[0].candidates[0].method, "name");
    assert.deepEqual([on[1].candidates[0].componentName, on[1].candidates[0].method, on[1].candidates[0].confidence], ["Switch", "laya", 0.61]);

    // A dead server leaves name matching intact and says why.
    const dead = suggestMappings(figma, codes);
    const d = await addLayaPicks(dead, figma, codes, `http://127.0.0.1:${await freePort()}`);
    assert.equal(d.used, true);
    assert.match(d.hint, /laya-serve/);
    assert.equal(dead[0].candidates[0].componentName, "Button");
  } finally {
    if (saved !== undefined) process.env.FIGMA_WRITE_LAYA_URL = saved;
  }
});

// ---- Real MCP server over stdio, with a fake plugin on the bridge ----

function startServer(env) {
  const child = spawn(process.execPath, [path.join(here, "server.js")], { env: { ...process.env, FIGMA_WRITE_NO_STAMP: "1", FIGMA_WRITE_TOKEN_FILE: TEST_TOKEN_FILE, ...env }, stdio: ["pipe", "pipe", "pipe"] });
  let buf = "";
  const replies = new Map();
  child.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) {
        const msg = JSON.parse(line);
        if (msg.id != null) replies.set(msg.id, msg);
      }
    }
  });
  let seq = 100;
  const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
  const rpc = async (method, params, timeoutMs = 30000) => {
    const id = ++seq;
    send({ jsonrpc: "2.0", id, method, params });
    const end = Date.now() + timeoutMs;
    while (!replies.has(id)) {
      if (Date.now() > end) throw new Error(`No reply to ${method} within ${timeoutMs}ms`);
      await wait(25);
    }
    return replies.get(id);
  };
  const tool = async (name, args, timeoutMs) => (await rpc("tools/call", { name, arguments: args }, timeoutMs)).result;
  return { child, send, rpc, tool };
}
const toolJson = (r) => {
  const t = r.content.find((c) => c.type === "text").text;
  try {
    return JSON.parse(t);
  } catch {
    throw new Error("tool returned an error instead of data: " + t.slice(0, 200));
  }
};

const EXPECTED_TOOLS = [
  "design_personas",
  "design_review",
  "figma_access_check",
  "figma_add_code_connect_map",
  "figma_apply_shader",
  "figma_color_tokens",
  "figma_create_from_spec",
  "figma_create_generative_plugin",
  "figma_create_shader",
  "figma_execute",
  "figma_export",
  "figma_export_many",
  "figma_export_video",
  "figma_find_nodes",
  "figma_generate_image",
  "figma_get_code_connect_map",
  "figma_get_code_connect_suggestions",
  "figma_get_context_for_code_connect",
  "figma_get_document",
  "figma_get_generative_plugin",
  "figma_get_metadata",
  "figma_get_node",
  "figma_get_repo_code_map",
  "figma_get_selection_brief",
  "figma_get_shader",
  "figma_get_styles",
  "figma_get_text",
  "figma_get_variable_defs",
  "figma_list_file_components_for_code_connect",
  "figma_list_file_shaders",
  "figma_list_generative_plugins",
  "figma_list_shaders",
  "figma_remove_code_connect_map",
  "figma_remove_repo_code_map",
  "figma_rest_file",
  "figma_rest_images",
  "figma_rest_status",
  "figma_run_generative_plugin",
  "figma_save_image",
  "figma_save_snapshot",
  "figma_send_code_connect_mappings",
  "figma_set_repo_code_map",
  "figma_set_text",
  "figma_snapshot_code_map",
  "figma_sync_code_map",
  "figma_update_generative_plugin",
  "figma_update_shader",
  "figma_write_status",
  "laya_decide",
  "laya_status",
];

await test(`MCP server starts over stdio, binds lazily, lists ${EXPECTED_TOOLS.length} tools`, async () => {
  const mcpPort = await freePort();
  const s = startServer({ FIGMA_WRITE_PORT: String(mcpPort) });
  try {
    const init = await s.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    const probeFree = new FigmaWriteBridge({ port: mcpPort, token: TOKEN });
    assert.equal(await probeFree.start(), true, "port should still be free before the first tool call");
    await probeFree.stop();
    s.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const list = await s.rpc("tools/list", {});
    assert.deepEqual(list.result.tools.map((t) => t.name).sort(), EXPECTED_TOOLS);
    assert.match(init.result.instructions || "", /Laya decision rules/, "server instructions must teach the Laya policy");
    assert.match(init.result.instructions || "", /Default colour tokens/, "server instructions must teach the colour tokens");
    const tokens = toolJson(await s.tool("figma_color_tokens", {}));
    assert.equal(tokens.count, 39);
    assert.equal(tokens.groups.info["info-100"], "#1B84FF");
    const prompts = await s.rpc("prompts/list", {});
    assert.deepEqual(prompts.result.prompts.map((p) => p.name).sort(), ["design_panel", "persona_accessibility", "persona_critic", "persona_interaction", "persona_researcher", "persona_strategist", "persona_systems", "persona_visual", "persona_writer"]);
    const status = toolJson(await s.tool("figma_write_status", {}));
    assert.equal(status.connected, false);
    assert.equal(status.server, SERVER_VERSION);
    const exec = await s.tool("figma_execute", { code: "return 1" });
    assert.equal(exec.isError, true);
    assert.match(exec.content[0].text, /No Figma plugin connected/);
  } finally {
    s.child.kill();
  }
});

await test("shaders, generative plugins, code connect and video work end to end (fake plugin, real ffmpeg)", async () => {
  const mcpPort = await freePort();
  const libDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfw-lib-"));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfw-out-"));
  const s = startServer({ FIGMA_WRITE_PORT: String(mcpPort), FIGMA_WRITE_LIBRARY_DIR: libDir });
  const seen = [];
  try {
    await s.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    s.send({ jsonrpc: "2.0", method: "notifications/initialized" });

    // Library tools work with no plugin connected.
    const created = await s.tool("figma_create_shader", { name: "Brand Glow", pixel: { code: "return [u, 0.2, v];", width: 40, height: 20 }, effects: [{ preset: "glow" }], params: { radius: 30 } });
    assert.equal(created.isError, undefined, JSON.stringify(created));
    assert.equal(created.content[0].type, "image");
    assert.equal(toolJson(created).created.id, "brand-glow");
    const bad = await s.tool("figma_create_shader", { name: "Broken", pixel: { code: "return 1;", width: 4, height: 4 } });
    assert.equal(bad.isError, true);
    const upd = toolJson(await s.tool("figma_update_shader", { id: "brand-glow", params: { radius: 50 } }));
    assert.equal(upd.updated.version, 2);
    assert.equal((await s.tool("figma_update_shader", { id: "aurora", name: "x" })).isError, true);
    const shaders = toolJson(await s.tool("figma_list_shaders", {}));
    assert.ok(shaders.shaders.some((x) => x.id === "brand-glow") && shaders.shaders.some((x) => x.id === "glass"));
    assert.equal((await s.tool("figma_get_shader", { id: "aurora" })).content[0].type, "image");

    const gp = toolJson(await s.tool("figma_create_generative_plugin", { name: "Grid Maker", code: "return params.columns * 2;", params: { columns: { type: "number", default: 12 }, gutter: { type: "number", required: true } } }));
    assert.equal(gp.created.id, "grid-maker");
    assert.equal((await s.tool("figma_create_generative_plugin", { name: "Bad", code: "return (;" })).isError, true);
    assert.equal(toolJson(await s.tool("figma_update_generative_plugin", { id: "grid-maker", description: "12 col" })).updated.version, 2);
    assert.equal(toolJson(await s.tool("figma_list_generative_plugins", {})).count, 1);
    const missing = await s.tool("figma_run_generative_plugin", { id: "grid-maker" });
    assert.match(missing.content[0].text, /No Figma plugin connected|Missing required parameter 'gutter'/);

    // Library tools never bind the port; a bridge tool does. Then connect a fake plugin that behaves
    // like plugin/code.js for the commands used below.
    await s.tool("figma_write_status", {});
    const token = fs.readFileSync(TEST_TOKEN_FILE, "utf8").trim();
    const sock = await openSocket(mcpPort, { token });
    assert.equal(sock.opened, true);
    const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
    const framePng = (i, w = 64, h = 36) => {
      const raw = new Uint8Array((w * 4 + 1) * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([...colors[i % 3], 255], y * (w * 4 + 1) + 1 + x * 4);
      return encodePng(w, h, raw).toString("base64");
    };
    sock.ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      seen.push(msg);
      const reply = (result) => sock.ws.send(JSON.stringify({ id: msg.id, result }));
      switch (msg.command) {
        case "export":
          return reply({ base64: framePng(Number(msg.params.nodeId.split(":")[1])), node: { id: msg.params.nodeId }, width: 64, height: 36 });
        case "render_frame":
          return reply({ base64: framePng(msg.params.frame, 65, 37), frame: msg.params.frame });
        case "list_children":
          return reply({ parent: { id: msg.params.parentId }, children: [{ id: "5:0" }, { id: "5:1" }, { id: "5:2" }] });
        case "components":
          return reply({ count: 1, components: [{ id: "9:1", name: "Button", type: "COMPONENT_SET", props: { Size: {} }, mapping: null }] });
        case "code_map_set":
          if (msg.params.nodeId === "9:9") return sock.ws.send(JSON.stringify({ id: msg.id, error: "Node not found: 9:9" }));
          return reply({ target: { id: msg.params.nodeId }, mapping: { componentName: msg.params.componentName } });
        case "code_map_get":
          return reply({ node: { id: msg.params.nodeId }, target: { id: "9:1", name: "Button" }, mapped: true, mapping: { componentName: "Button", source: "components/Button.tsx" }, props: { Size: {} } });
        default:
          return reply({ echo: msg.command, params: msg.params });
      }
    });

    // Colour token names resolve to hex before the spec reaches the plugin.
    const spec = toolJson(await s.tool("figma_create_from_spec", { spec: { type: "FRAME", fill: "info-100", stroke: "#123456", children: [{ type: "TEXT", text: { characters: "Hi", color: "heading" } }] } }));
    assert.equal(spec.params.spec.fill, "#1B84FF");
    assert.equal(spec.params.spec.stroke, "#123456");
    assert.equal(spec.params.spec.children[0].text.color, "#071437");
    const badColor = await s.tool("figma_create_from_spec", { spec: { type: "FRAME", fill: "brand-blue" } });
    assert.equal(badColor.isError, true);
    assert.match(badColor.content[0].text, /Unknown colour 'brand-blue'/);
    sock.ws.send(JSON.stringify({ type: "state", state: { fileName: "Fake", editsAllowed: true } }));
    await wait(150);

    const ran = toolJson(await s.tool("figma_run_generative_plugin", { id: "grid-maker", params: { gutter: 8 } }));
    assert.equal(ran.params.columns, 12);
    // params reach the plugin body from an outer scope, so a plugin may declare its own `params`.
    assert.equal(seen.find((m) => m.command === "execute").params.code, 'return await ((params) => (async function () {\nreturn params.columns * 2;\n})())({"gutter":8,"columns":12});');
    assert.equal(toolJson(await s.tool("figma_get_generative_plugin", { id: "grid-maker" })).runs, 1);

    const applied = toolJson(await s.tool("figma_apply_shader", { id: "brand-glow", nodeIds: ["1-2"], params: { radius: 80 } }));
    const ap = applied.params;
    assert.deepEqual(ap.nodeIds, ["1:2"]);
    assert.equal(pngSize(Buffer.from(ap.imageBase64, "base64")).width, 40);
    assert.equal(ap.effects[0].options.radius, 80);
    assert.deepEqual({ id: ap.shader.id, version: ap.shader.version }, { id: "brand-glow", version: 2 });

    const batch = toolJson(await s.tool("figma_send_code_connect_mappings", { mappings: [{ nodeId: "9:1", componentName: "Button" }, { nodeId: "9:9", componentName: "Nope" }] }));
    assert.deepEqual([batch.saved, batch.failed], [1, 1]);

    const codeDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfw-code-"));
    fs.mkdirSync(path.join(codeDir, "components"));
    fs.writeFileSync(path.join(codeDir, "components", "Button.tsx"), "export const Button = () => <button/>;\n");
    const sug = toolJson(await s.tool("figma_get_code_connect_suggestions", { sourceDir: codeDir }));
    assert.equal(sug.suggestions[0].candidates[0].file, "components/Button.tsx");
    const ctx = await s.tool("figma_get_context_for_code_connect", { nodeId: "9:1", sourceDir: codeDir });
    assert.equal(ctx.content[0].type, "image");
    assert.match(toolJson(ctx).sourceFile.code, /export const Button/);
    fs.rmSync(codeDir, { recursive: true, force: true });

    for (const format of ["mp4", "gif", "webm"]) {
      const out = path.join(outDir, "slides." + format);
      const v = toolJson(await s.tool("figma_export_video", { savePath: out, parentId: "5:9", frameDurationSeconds: 0.5 }, 120000));
      assert.equal(v.frames, 3, format);
      assert.ok(fs.statSync(out).size > 200, format + " file written");
    }
    const anim = path.join(outDir, "anim.mp4");
    const av = toolJson(await s.tool("figma_export_video", { savePath: anim, animate: { nodeId: "7:1", code: "node.rotation = t * 90;", frames: 6, durationSeconds: 1 } }, 120000));
    assert.deepEqual([av.frames, av.width, av.height, av.durationSeconds], [6, 64, 36, 1]);
    assert.ok(fs.statSync(anim).size > 200);
    const both = await s.tool("figma_export_video", { savePath: anim, nodeIds: ["1:1"], parentId: "5:9" });
    assert.equal(both.isError, true);
    sock.ws.close();
  } finally {
    s.child.kill();
    fs.rmSync(libDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});


await test("figma_generate_image generates through the provider and places the image (stub generator, fake plugin)", async () => {
  const w0 = 48, h0 = 32;
  const raw = new Uint8Array((w0 * 4 + 1) * h0);
  for (let i = 0; i < raw.length; i++) if (i % (w0 * 4 + 1)) raw[i] = 200;
  const stubPng = encodePng(w0, h0, raw);
  const asked = [];
  const stub = http.createServer((req, res) => {
    asked.push(new URL(req.url, "http://x"));
    if (decodeURIComponent(req.url).includes("/prompt/fail")) return res.writeHead(400).end("bad prompt");
    res.writeHead(200, { "content-type": "image/png" }).end(stubPng);
  });
  await new Promise((r) => stub.listen(0, "127.0.0.1", r));
  const mcpPort = await freePort();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfw-img-"));
  const s = startServer({ FIGMA_WRITE_PORT: String(mcpPort), FIGMA_IMAGE_GEN_URL: `http://127.0.0.1:${stub.address().port}` });
  const seen = [];
  try {
    await s.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    s.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const offline = await s.tool("figma_generate_image", { prompt: "a mug" });
    assert.match(offline.content[0].text, /No Figma plugin connected/);
    assert.equal(asked.length, 0, "nothing is generated when Figma cannot take it");

    const token = fs.readFileSync(TEST_TOKEN_FILE, "utf8").trim();
    const sock = await openSocket(mcpPort, { token });
    sock.ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      seen.push(msg);
      const reply = (result) => sock.ws.send(JSON.stringify({ id: msg.id, result }));
      if (msg.command !== "place_image") return reply({});
      if (msg.params.dryRun) return reply({ ok: true, size: msg.params.nodeIds.length ? { width: 300, height: 150 } : null });
      return reply({ created: !msg.params.nodeIds.length, placed: (msg.params.nodeIds.length ? msg.params.nodeIds : ["3:1"]).map((id) => ({ id })) });
    });
    sock.ws.send(JSON.stringify({ type: "state", state: { fileName: "Fake", editsAllowed: true } }));
    await wait(150);

    const out = path.join(outDir, "hero.png");
    const filled = await s.tool("figma_generate_image", { prompt: "a mug", nodeIds: ["1-2"], seed: 7, savePath: out, fill: { scaleMode: "FIT" } });
    assert.equal(filled.isError, undefined, JSON.stringify(filled));
    assert.equal(filled.content[0].type, "image");
    const fj = toolJson(filled);
    assert.deepEqual([fj.seed, fj.width, fj.height, fj.mimeType], [7, w0, h0, "image/png"]);
    assert.deepEqual([asked[0].searchParams.get("width"), asked[0].searchParams.get("height"), asked[0].searchParams.get("seed")], ["600", "300", "7"], "size follows the layer at 2x");
    assert.equal(asked[0].pathname, "/prompt/a%20mug");
    const place = seen.filter((m) => m.command === "place_image" && !m.params.dryRun)[0].params;
    assert.deepEqual(place.nodeIds, ["1:2"]);
    assert.equal(place.fill.scaleMode, "FIT");
    assert.equal(place.meta.prompt, "a mug");
    assert.ok(Buffer.from(place.imageBase64, "base64").equals(stubPng));
    assert.ok(fs.readFileSync(out).equals(stubPng));

    const created = toolJson(await s.tool("figma_generate_image", { prompt: "sky" }));
    assert.equal(created.created, true);
    assert.equal(asked[1].searchParams.get("width"), "1024");
    assert.ok(Number.isInteger(created.seed));

    const bad = await s.tool("figma_generate_image", { prompt: "fail" });
    assert.equal(bad.isError, true);
    assert.match(bad.content[0].text, /answered 400: bad prompt/);
    sock.ws.close();
  } finally {
    s.child.kill();
    stub.close();
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});


// ---- A developer on a free, view-only seat: no plugin, no token, no Figma ----

await test("view-only seat reads the design and the code map from a snapshot, with no plugin", async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "wfw-viewer-"));
  fs.mkdirSync(path.join(project, ".figma"));
  // What figma_save_snapshot writes: the layer tree plus styles, variables and the code map.
  const snapshot = {
    savedAt: new Date().toISOString(),
    fileName: "Partner Portal",
    root: {
      id: "1:1",
      name: "Home",
      type: "FRAME",
      width: 1440,
      height: 900,
      children: [
        {
          id: "1:2",
          name: "Primary button",
          type: "INSTANCE",
          width: 180,
          height: 48,
          mainComponent: { id: "9:1", name: "Size=Large", set: "Button" },
          children: [
            {
              id: "1:3",
              name: "Label",
              type: "TEXT",
              width: 120,
              height: 20,
              fills: [{ type: "SOLID", color: "#ffffff" }],
              text: { characters: "Get the App", fontSize: 16, fontName: { family: "Inter", style: "Semi Bold" }, lineHeight: "AUTO", letterSpacing: "0%", textAlignHorizontal: "CENTER" },
            },
          ],
        },
        { id: "1:4", name: "Hero image", type: "RECTANGLE", width: 600, height: 400, fills: [{ type: "IMAGE", scaleMode: "FILL" }] },
      ],
    },
    styles: { counts: { paint: 1, text: 1, effect: 0, grid: 0 }, styles: { paint: [{ name: "Brand/Primary", paints: [{ type: "SOLID", color: "#466efa" }] }] } },
    variables: { collections: 1, variableCollections: [{ name: "Brand", modes: [{ name: "Mode 1" }], variables: [{ name: "Primary", type: "COLOR", values: { "Mode 1": "#466efa" } }] }] },
    codeMap: { "9:1": { componentName: "AppButton", framework: "React Native", importPath: "@/components/base", source: "src/components/base/AppButton.js" } },
  };
  fs.writeFileSync(path.join(project, ".figma", "design-snapshot.json"), JSON.stringify(snapshot));
  fs.writeFileSync(path.join(project, ".figma", "code-map.json"), JSON.stringify({ version: 1, components: { "9:2": { componentName: "AppCard", framework: "React Native" } } }));

  const mcpPort = await freePort();
  const s = startServer({ FIGMA_WRITE_PORT: String(mcpPort), FIGMA_PROJECT_DIR: project });
  try {
    await s.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "viewer", version: "0" } });
    s.send({ jsonrpc: "2.0", method: "notifications/initialized" });

    // The check tells the developer what works on their machine.
    const check = toolJson(await s.tool("figma_access_check", { repoDir: project }));
    assert.equal(check.plugin.connected, false, "no plugin for a view-only seat");
    assert.equal(check.snapshot.layers, 4);
    assert.match(check.worksForYou.join(" "), /Snapshot found/);

    // Reads answer from the snapshot without anyone passing a path.
    const meta = toolJson(await s.tool("figma_get_metadata", {}));
    assert.equal(meta.source, "snapshot");
    assert.equal(meta.figmaFile, "Partner Portal");
    assert.equal(meta.layers, 4);
    assert.equal(meta.textLayers, 1);

    const found = toolJson(await s.tool("figma_find_nodes", { text: "Get the App" }));
    assert.equal(found.count, 1);
    assert.equal(found.nodes[0].path, "Home / Primary button");

    const node = toolJson(await s.tool("figma_get_node", { nodeId: "1:3" }));
    assert.equal(node.node.text.fontName.family, "Inter");
    assert.equal(node.node.fills[0].color, "#ffffff");

    const texts = toolJson(await s.tool("figma_get_text", {}));
    assert.equal(texts.count, 1);
    assert.equal(texts.texts[0].characters, "Get the App");

    const styles = toolJson(await s.tool("figma_get_styles", {}));
    assert.equal(styles.styles.paint[0].paints[0].color, "#466efa");
    const vars = toolJson(await s.tool("figma_get_variable_defs", {}));
    assert.equal(vars.variableCollections[0].variables[0].values["Mode 1"], "#466efa");

    // Code Connect: an instance resolves to the component behind it, from the snapshot's map.
    const map = toolJson(await s.tool("figma_get_code_connect_map", { nodeId: "1:2" }));
    assert.equal(map.mapped, true);
    assert.equal(map.mapping.componentName, "AppButton");
    assert.match(map.snippet, /import \{ AppButton \} from "@\/components\/base";/);

    // The repo store merges in, so both sources are visible at once.
    const all = toolJson(await s.tool("figma_get_code_connect_map", {}));
    // Same {id, name, mapping} rows as the live answer, so merge-code-connect.mjs reads either.
    assert.deepEqual(all.components.map((c) => c.mapping.componentName).sort(), ["AppButton", "AppCard"]);
    assert.ok(all.components.every((c) => c.id && c.mapping));

    // Adding a mapping with no plugin lands in the repo instead of failing.
    const added = toolJson(await s.tool("figma_add_code_connect_map", { nodeId: "9:3", componentName: "AppChip", framework: "React Native" }));
    assert.equal(added.source, "repo");
    const store = JSON.parse(fs.readFileSync(path.join(project, ".figma", "code-map.json"), "utf8"));
    assert.equal(store.components["9:3"].componentName, "AppChip");

    // A write tool still refuses: a viewer cannot change the file.
    const write = await s.tool("figma_execute", { code: "return 1" });
    assert.equal(write.isError, true);
    assert.match(write.content[0].text, /No Figma plugin connected/);
  } finally {
    s.child.kill();
    fs.rmSync(project, { recursive: true, force: true });
  }
});

await test("laya_status and laya_decide reach a Laya server, batch states and guard bad questions", async () => {
  // A fake laya-serve: answers every choice with its first option.
  const seen = [];
  const seenQ = [];
  const laya = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/health") return res.end(JSON.stringify({ status: "ok", loaded: ["english"] }));
      const b = JSON.parse(body);
      seen.push(b.state);
      seenQ.push(b.questions);
      // Like the real laya-serve: score levels must be a list.
      const badScore = Object.entries(b.questions).find(([, q]) => q.type === "score" && !Array.isArray(q.criteria));
      if (badScore) {
        res.statusCode = 422;
        return res.end(JSON.stringify({ detail: `question '${badScore[0]}': a score question takes 'criteria' as a list of level descriptions, index 0 first` }));
      }
      const answers = Object.fromEntries(Object.entries(b.questions).map(([k, q]) => [k, { choice: Object.keys(q.criteria)[0], confidence: 0.7 }]));
      res.end(JSON.stringify({ answers, routing: { model: "english" } }));
    });
  });
  await new Promise((r) => laya.listen(0, "127.0.0.1", r));
  const s = startServer({ FIGMA_WRITE_PORT: String(await freePort()), FIGMA_WRITE_LAYA_URL: `http://127.0.0.1:${laya.address().port}` });
  try {
    await s.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    s.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const st = toolJson(await s.tool("laya_status", {}));
    assert.equal(st.reachable, true);
    assert.match(st.rules, /DO NOT use Laya/);
    const q = { role: { type: "choice", instructions: "Role of this layer?", criteria: { button: "a tappable control", decoration: "no meaning" } } };
    const many = toolJson(await s.tool("laya_decide", { states: ["Book a seat", "Blob 3"], questions: q }));
    assert.equal(many.count, 2);
    assert.equal(many.results[1].answers.role.choice, "button");
    assert.deepEqual(seen, ["Book a seat", "Blob 3"]);
    const bad = await s.tool("laya_decide", { state: "x", questions: { role: { type: "choice", instructions: "?", criteria: { only: "one" } } } });
    assert.equal(bad.isError, true);
    assert.match(bad.content[0].text, /2 to 11 options/);
    // Score levels as an object with numeric keys arrive at the server as a list, lowest first.
    const levels = { 2: "severe", 0: "none", 1: "minor" };
    const scored = await s.tool("laya_decide", { state: "x", questions: { risk: { type: "score", instructions: "How risky?", criteria: levels } } });
    assert.notEqual(scored.isError, true, scored.content?.[0]?.text);
    assert.deepEqual(seenQ.at(-1).risk.criteria, ["none", "minor", "severe"]);
    // A list passes through unchanged.
    await s.tool("laya_decide", { state: "x", questions: { risk: { type: "score", instructions: "How risky?", criteria: ["low", "high"] } } });
    assert.deepEqual(seenQ.at(-1).risk.criteria, ["low", "high"]);
    const oneLevel = await s.tool("laya_decide", { state: "x", questions: { risk: { type: "score", instructions: "?", criteria: ["only"] } } });
    assert.equal(oneLevel.isError, true);
  } finally {
    s.child.kill();
    laya.close();
  }
});

await test("design review scores a screen and ties findings to layers and personas", async () => {
  const txt = (id, chars, size, color, x, w) => ({ id, name: chars, type: "TEXT", width: w, height: 16, abs: { x, y: 100, width: w, height: 16 }, fills: [{ type: "SOLID", color }], text: { characters: chars, fontSize: size, fontName: { family: "Inter", style: "Regular" } } });
  const screen = {
    id: "1:1", name: "Home", type: "FRAME", width: 390, height: 844, abs: { x: 0, y: 0, width: 390, height: 844 }, fills: [{ type: "SOLID", color: "#ffffff" }],
    children: [
      txt("1:2", "Faint label", 11, "#c4cada", 20, 80),
      { id: "1:3", name: "Card", type: "FRAME", width: 200, height: 60, abs: { x: 20, y: 200, width: 200, height: 60 }, layout: { mode: "HORIZONTAL", gap: 6, padding: { top: 10, right: 10, bottom: 10, left: 10 } }, children: [txt("1:4", "Lorem ipsum runs far past the card edge", 14, "#071437", 30, 260)] },
      { id: "1:5", name: "Button/Book", type: "FRAME", width: 300, height: 52, abs: { x: 20, y: 700, width: 300, height: 52 }, fills: [{ type: "SOLID", color: "#2f50e4" }] },
      { id: "1:6", name: "Button/Track", type: "FRAME", width: 300, height: 52, abs: { x: 20, y: 760, width: 300, height: 52 }, fills: [{ type: "SOLID", color: "#2f50e4" }] },
      { id: "1:7", name: "Close", type: "FRAME", width: 24, height: 24, abs: { x: 350, y: 60, width: 24, height: 24 } },
      { id: "1:8", name: "Mystery", type: "FRAME", width: 30, height: 30, abs: { x: 300, y: 60, width: 30, height: 30 } },
    ],
  };
  const r = reviewTree(screen, { tappable: new Set(["1:8"]) });
  const rules = (id) => r.findings.filter((f) => f.layer.id === id).map((f) => f.rule).sort();
  assert.deepEqual(rules("1:2"), ["contrast", "min-text-size"]);
  assert.deepEqual(rules("1:4"), ["placeholder-copy", "text-overflow"]);
  assert.deepEqual(rules("1:7"), ["touch-target"]);
  assert.deepEqual(rules("1:8"), ["touch-target"], "Laya-tappable layers are checked too");
  assert.ok(r.findings.some((f) => f.rule === "competing-primary" && f.persona === "interaction"));
  assert.ok(r.findings.some((f) => f.rule === "spacing-grid"));
  assert.ok(r.score.overall < 100 && r.score.byCategory.accessibility.score < 100);
  assert.equal(Math.round(contrast({ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 })), 21);
});

await test("colour tokens resolve by name and leave hex specs untouched", async () => {
  assert.equal(Object.keys(COLOR_TOKENS).length, 39);
  assert.equal(resolveColor("Warning-5"), "#FEFBF2");
  assert.equal(resolveColor(" heading "), "#071437");
  for (const v of ["#fff", "#FF5733", "#FF573380", "none"]) assert.equal(resolveColor(v), v);
  assert.throws(() => resolveColor("blue"), /Unknown colour 'blue'/);
  const hexSpec = { type: "FRAME", fill: "#FFFFFF", stroke: "#000", children: [{ type: "TEXT", text: { characters: "a", color: "#111111" } }, { type: "RECTANGLE" }] };
  const before = JSON.stringify(hexSpec);
  assert.equal(JSON.stringify(resolveSpecColors(hexSpec)), before, "plain hex specs pass through byte-identical");
  const tokenSpec = { type: "FRAME", fill: "bg-light", children: [{ type: "FRAME", children: [{ type: "TEXT", text: { characters: "a", color: "success-active" } }] }] };
  const out = resolveSpecColors(tokenSpec);
  assert.equal(out.fill, "#F9FBFC");
  assert.equal(out.children[0].children[0].text.color, "#04B440");
  assert.equal(tokenSpec.fill, "bg-light", "input is not mutated");
  assert.ok(isTokenColor("#1b84ff") && isTokenColor("#1B84FF80") && !isTokenColor("#2f50e4"));
  const r = reviewTree({ id: "1:1", name: "S", type: "FRAME", width: 100, height: 100, abs: { x: 0, y: 0, width: 100, height: 100 }, fills: [{ type: "SOLID", color: "#2f50e4" }], children: [{ id: "1:2", name: "B", type: "FRAME", width: 10, height: 10, abs: { x: 0, y: 0, width: 10, height: 10 }, fills: [{ type: "SOLID", color: "#1b84ff" }] }] });
  assert.deepEqual(r.offTokenColors, ["#2f50e4"]);
});

for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
