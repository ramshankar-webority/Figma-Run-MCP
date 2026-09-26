// Shaders for Webority Figma Write.
// Figma's Plugin API has no GLSL fills, so a shader here is a saved recipe with two optional parts:
//   pixel:   a fragment function in JavaScript, rendered on this PC to a PNG and applied as an image fill
//   effects: Figma effect presets (glass, noise, texture, glow, shadow, blurs) applied natively
// Recipes live in library/shaders/<id>.json, so they work across files and without Figma open.

import { spawnSync } from "node:child_process";
import { encodePng } from "./png.js";

export const EFFECT_PRESETS = ["glass", "noise", "texture", "glow", "shadow", "background-blur", "layer-blur"];
export const MAX_PIXELS = 4096;

// GLSL-style helpers available inside pixel code.
const HELPERS = `
const PI = Math.PI, TAU = Math.PI * 2;
const {sin, cos, tan, abs, floor, ceil, sqrt, pow, exp, log, min, max, atan2, hypot, round, sign} = Math;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
const step = (e, x) => (x < e ? 0 : 1);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const length = (x, y) => Math.hypot(x, y);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
const noise = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), ux), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy);
};
const fbm = (x, y, octaves = 5) => { let v = 0, a = 0.5; for (let i = 0; i < octaves; i++) { v += a * noise(x, y); x *= 2; y *= 2; a *= 0.5; } return v; };
const hex = (h) => { const m = String(h).replace("#", ""); return [parseInt(m.slice(0, 2), 16) / 255, parseInt(m.slice(2, 4), 16) / 255, parseInt(m.slice(4, 6), 16) / 255]; };
const mixColor = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
`;

export const BUILT_IN_SHADERS = [
  ...EFFECT_PRESETS.map((preset) => ({
    id: preset,
    name: preset.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    description: `Native Figma ${preset} effect. Pass options through params, e.g. {"radius": 24}.`,
    builtIn: true,
    version: 1,
    pixel: null,
    effects: [{ preset, options: {} }],
    fill: null,
    params: {},
  })),
  {
    id: "aurora",
    name: "Aurora gradient",
    description: "Soft flowing multi-colour gradient from layered noise. Params: colorA, colorB, colorC (hex), scale, t.",
    builtIn: true,
    version: 1,
    pixel: {
      width: 1024,
      height: 1024,
      code:
        "const a = hex(params.colorA), b = hex(params.colorB), c = hex(params.colorC);\n" +
        "const n = fbm(u * params.scale + t, v * params.scale - t * 0.5);\n" +
        "const m = fbm(u * params.scale * 0.5 - n, v * params.scale * 0.5 + n + t);\n" +
        "return mixColor(mixColor(a, b, smoothstep(0.2, 0.8, n)), c, smoothstep(0.35, 0.9, m));",
    },
    effects: [],
    fill: { scaleMode: "FILL", blendMode: "NORMAL", opacity: 1, mode: "replace" },
    params: { colorA: "#1B1464", colorB: "#FA4028", colorC: "#FFC36B", scale: 3 },
  },
  {
    id: "film-grain",
    name: "Film grain",
    description: "Transparent grain overlay added on top of existing fills. Params: amount (0-1), size (px), t.",
    builtIn: true,
    version: 1,
    pixel: {
      width: 512,
      height: 512,
      code: "const g = hash(Math.floor(x / params.size) + t * 17.0, Math.floor(y / params.size) - t * 13.0);\nreturn [g, g, g, params.amount];",
    },
    effects: [],
    fill: { scaleMode: "TILE", blendMode: "OVERLAY", opacity: 1, mode: "add" },
    params: { amount: 0.35, size: 1 },
  },
];

// Renders pixel code to PNG bytes. Code is the body of fn(u, v, x, y, width, height, t, params)
// returning [r, g, b] or [r, g, b, a] with 0-1 channels. u,v run 0..1 left-to-right, top-to-bottom.
//
// Pixel code can come from any library JSON, so it is untrusted. node:vm alone is not a security
// boundary, so the render is layered:
//   1. A separate Node process with --permission (no file system, child processes, workers, addons),
//      --disallow-code-generation-from-strings (no Function("return process") even on a host function
//      reached through a stack trace), and an empty environment (no tokens to steal).
//   2. Strict mode in that process, so stack frames never hand out a host `this`.
//   3. A fresh vm context given no host objects (params travel as JSON). The host never calls anything on
//      a sandbox object: the pixels are read with the host realm's own TypedArray getters, and sandbox
//      errors are turned into a string inside the sandbox.
// Node 24 has no network permission, so layer 1 alone does not stop a request; layers 2 and 3 keep the
// code from ever reaching process. Move to --allow-net style network denial when the runtime has it.
const CHILD = `"use strict";
const vm = require("node:vm");
const TA = Object.getPrototypeOf(Uint8Array.prototype);
const get = (k) => Object.getOwnPropertyDescriptor(TA, k).get;
const getBuffer = get("buffer"), getOffset = get("byteOffset"), getLength = get("byteLength");
const call = Function.prototype.call.bind(Function.prototype.call);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const job = JSON.parse(input);
  const out = (o) => process.stdout.write(JSON.stringify(o));
  let script;
  try {
    script = new vm.Script(job.src, { filename: "shader.js" });
  } catch (e) {
    return out({ error: "syntax", message: String(e.message) });
  }
  let result;
  try {
    const ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    result = script.runInContext(ctx, { timeout: job.timeoutMs });
  } catch (e) {
    // Only host errors reach here (the sandbox catches its own), e.g. the vm timeout.
    return out({ error: e && e.code === "ERR_SCRIPT_EXECUTION_TIMEOUT" ? "timeout" : "runtime", message: "renderer error" });
  }
  if (typeof result === "string") return out({ error: "runtime", message: result });
  try {
    // Host-realm getters: they check the internal slot and never run sandbox code. A fake or proxied
    // array throws here instead.
    const buf = Buffer.from(call(getBuffer, result), call(getOffset, result), call(getLength, result));
    if (buf.length !== job.expected) throw new Error("size");
    out({ raw: buf.toString("base64") });
  } catch {
    out({ error: "runtime", message: "Pixel code did not produce an image." });
  }
});
`;

export function renderPixelShader({ code, width, height, t = 0, params = {}, timeoutMs = 15000 }) {
  const W = Math.round(width), H = Math.round(height);
  if (!(W >= 1 && H >= 1 && W <= MAX_PIXELS && H <= MAX_PIXELS)) throw new Error(`Shader size must be 1-${MAX_PIXELS} px per side (got ${width}x${height}).`);
  const src = `${HELPERS}
const W = ${W}, H = ${H}, T = ${Number(t) || 0}, PARAMS = JSON.parse(${JSON.stringify(JSON.stringify(params ?? {}))});
const raw = new Uint8Array((W * 4 + 1) * H);
const shade = function (u, v, x, y, width, height, t, params) {
${code}
};
let __err = "";
try {
for (let y = 0; y < H; y++) {
  let i = y * (W * 4 + 1);
  raw[i++] = 0;
  const v = H === 1 ? 0 : y / (H - 1);
  for (let x = 0; x < W; x++) {
    const c = shade(W === 1 ? 0 : x / (W - 1), v, x, y, W, H, T, PARAMS);
    if (!c || typeof c.length !== "number" || c.length < 3) throw new Error("Pixel code must return [r, g, b] or [r, g, b, a] (0-1). Got " + JSON.stringify(c) + " at " + x + "," + y);
    raw[i++] = Math.round(Math.min(1, Math.max(0, c[0])) * 255);
    raw[i++] = Math.round(Math.min(1, Math.max(0, c[1])) * 255);
    raw[i++] = Math.round(Math.min(1, Math.max(0, c[2])) * 255);
    raw[i++] = Math.round(Math.min(1, Math.max(0, c.length > 3 ? c[3] : 1)) * 255);
  }
}
} catch (e) {
  // Turn the error into a plain string here, so the host never touches a sandbox object.
  try { __err = String(e && e.message); } catch (_) { __err = "Pixel code threw an error."; }
  if (typeof __err !== "string" || !__err) __err = "Pixel code threw an error.";
}
__err || raw;`;
  const r = spawnSync(process.execPath, ["--permission", "--disallow-code-generation-from-strings", "-e", CHILD], {
    input: JSON.stringify({ src, timeoutMs, expected: (W * 4 + 1) * H }),
    env: process.platform === "win32" ? { SystemRoot: process.env.SystemRoot || "C:\\Windows" } : {},
    encoding: "utf8",
    timeout: timeoutMs + 5000,
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  const timedOut = () => new Error(`Shader render timed out after ${timeoutMs}ms at ${W}x${H}. Use a smaller size or simpler code.`);
  if (r.error) throw /ETIMEDOUT/.test(r.error.code || r.error.message) ? timedOut() : new Error("Shader renderer failed to start: " + r.error.message);
  let res;
  try {
    res = JSON.parse(r.stdout);
  } catch {
    throw new Error("Shader renderer crashed: " + String(r.stderr || "no output").trim().slice(0, 500));
  }
  if (res.error === "syntax") throw new Error("Shader syntax error: " + res.message);
  if (res.error === "timeout") throw timedOut();
  if (res.error) throw new Error("Shader error: " + res.message);
  return encodePng(W, H, new Uint8Array(Buffer.from(res.raw, "base64")));
}

export function validateShader(s) {
  if (!s.pixel && !(s.effects && s.effects.length)) throw new Error("A shader needs pixel code, effects, or both.");
  for (const e of s.effects || []) {
    if (!EFFECT_PRESETS.includes(e.preset)) throw new Error(`Unknown effect preset '${e.preset}'. Use: ${EFFECT_PRESETS.join(", ")}.`);
  }
}
