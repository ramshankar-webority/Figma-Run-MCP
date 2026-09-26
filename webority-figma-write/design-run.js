// Runs a design folder (preamble.js + s*.js in order) against the open Figma file via the write bridge.
// Optional in the folder: icons.json (injected as ISX) and assets/<id>.jpg (injected as B64 when a
// step references img("<id>")).
// Usage: node design-run.js designs/music-v2 [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FigmaWriteBridge } from "./bridge.js";
import { ensureToken } from "./lib/token.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, process.argv[2] || "designs/music");
const preamble = fs.readFileSync(path.join(dir, "preamble.js"), "utf8");
const iconsFile = path.join(dir, "icons.json");
const ISX = fs.existsSync(iconsFile) ? fs.readFileSync(iconsFile, "utf8") : "{}";
const steps = fs.readdirSync(dir).filter((f) => /^s\d.*\.js$/.test(f)).sort();

function withAssets(body) {
  const ids = [...new Set([...body.matchAll(/"(\d{4,10})"/g)].map((m) => m[1]))].filter((id) => fs.existsSync(path.join(dir, "assets", id + ".jpg")));
  const b64 = {};
  for (const id of ids) b64[id] = fs.readFileSync(path.join(dir, "assets", id + ".jpg")).toString("base64");
  return ["const ISX = " + ISX + ";", "const B64 = " + JSON.stringify(b64) + ";", preamble, body].join("\n");
}

// Compile-check every step locally before touching Figma.
const AsyncFunction = (async () => {}).constructor;
for (const f of steps) {
  try {
    new AsyncFunction("figma", "SECTION_ID", withAssets(fs.readFileSync(path.join(dir, f), "utf8")));
  } catch (e) {
    console.log(`FAIL compile ${f}: ${e.message}`);
    process.exit(1);
  }
}
console.log("compile OK: " + steps.join(", "));
if (process.argv.includes("--check")) process.exit(0);

const token = ensureToken({ legacyDir: here, log: console.log });
const bridge = new FigmaWriteBridge({ port: Number(process.env.FIGMA_WRITE_PORT || 3692), token, log: console.log });
if (!(await bridge.start())) { console.log("FAIL bridge: " + bridge.bindError); process.exit(1); }

let last = "";
console.log("Waiting for plugin: design editor + Allow edits...");
const waitUntil = Date.now() + 5 * 60 * 1000;
while (!(bridge.status().connected && bridge.status().editsAllowed && bridge.status().editorType === "figma")) {
  if (Date.now() > waitUntil) {
    console.log("FAIL: no plugin in the design editor with Allow edits after 5 minutes. Open the plugin, tick Allow edits, and rerun.");
    await bridge.stop();
    process.exit(1);
  }
  const st = JSON.stringify(bridge.status());
  if (st !== last) { console.log("[state] " + st); last = st; }
  await new Promise((r) => setTimeout(r, 1000));
}

let sectionId = null;
const clearIdx = process.argv.indexOf("--replace");
if (clearIdx > 0) {
  const oldId = process.argv[clearIdx + 1];
  const r = await bridge.request("execute", { code: `const n = await figma.getNodeByIdAsync(${JSON.stringify(oldId)}); if (n) { n.remove(); return "removed"; } return "not found";`, timeoutMs: 10000 }, 15000);
  console.log("replace " + oldId + ": " + r.result);
}
let failed = 0;
for (const f of steps) {
  const body = fs.readFileSync(path.join(dir, f), "utf8").replaceAll("SECTION_ID", JSON.stringify(sectionId));
  try {
    const r = await bridge.request("execute", { code: withAssets(body), timeoutMs: 110000 }, 120000);
    if (r?.result?.sectionId) sectionId = r.result.sectionId;
    console.log(`PASS ${f} ${JSON.stringify(r.result)}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: ${e.message}`);
    if (!sectionId) break;
  }
}
if (sectionId) {
  await bridge.request("execute", {
    code: `const n = await figma.getNodeByIdAsync(${JSON.stringify(sectionId)}); figma.currentPage.selection = [n]; figma.viewport.scrollAndZoomIntoView([n]); return n;`,
    timeoutMs: 10000,
  }, 15000).then(() => console.log("PASS select + zoom"), (e) => console.log("FAIL select: " + e.message));
}
console.log(`DONE sectionId=${sectionId} failed=${failed}`);
await bridge.stop();
process.exit(failed ? 1 : 0);
