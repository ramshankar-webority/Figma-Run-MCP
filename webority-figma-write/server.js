// Webority Figma Write MCP (v1.7.0): MCP server over stdio.
// Lets Claude read and write the Figma file open in Figma desktop, through the
// "Webority Figma Write" plugin. Local only: ports 3692-3699 (first free), per-machine token, no Figma rate limits.
// stdout is the MCP protocol; every log line goes to stderr.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FigmaWriteBridge } from "./bridge.js";
import { registerExtraTools } from "./lib/tools-extra.js";
import { registerReadTools } from "./lib/tools-read.js";
import { registerOpenTools } from "./lib/tools-open.js";
import { registerLayaTools } from "./lib/tools-laya.js";
import { registerDesignTools } from "./lib/tools-design.js";
import { registerImageTools } from "./lib/tools-image.js";
import { registerCreativeTools } from "./lib/tools-creative.js";
import { registerFeatureTools } from "./lib/tools-figma-features.js";
import { registerReferenceTools } from "./lib/tools-references.js";
import { registerFigma2026Tools } from "./lib/tools-figma-2026.js";
import { CREATIVE_RULES, handlePanelRequest } from "./lib/creative.js";
import { LAYA_RULES } from "./lib/laya.js";
import { REFERENCE_RULES } from "./lib/references.js";
import { COLOR_TOKENS, COLOR_TOKEN_GROUPS, COLOR_TOKEN_RULES, resolveSpecColors } from "./lib/color-tokens.js";
import { normId, prepareSavePath } from "./lib/util.js";
import { ensureToken, restrictToOwner } from "./lib/token.js";

export const VERSION = "1.7.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const log = (line) => process.stderr.write(line + "\n");

// Figma only lets the plugin reach the ports its manifest lists.
function manifestPorts() {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(here, "plugin", "manifest.json"), "utf8"));
    const ports = (manifest.networkAccess?.allowedDomains || []).map((d) => Number(String(d).split(":").pop())).filter(Boolean);
    return ports.length ? ports : null;
  } catch {
    return null;
  }
}
const MANIFEST_PORTS = manifestPorts();
// Several sessions at once: with no FIGMA_WRITE_PORT, a session binds the first free manifest port,
// and each Figma file's panel pairs with one session that has no file yet.
const PORTS = process.env.FIGMA_WRITE_PORT
  ? [Number(process.env.FIGMA_WRITE_PORT)]
  : MANIFEST_PORTS ?? [3692, 3693, 3694, 3695, 3696, 3697, 3698, 3699];
const PORT = PORTS[0];

// A FIGMA_WRITE_PORT outside the manifest list would leave the panel on "Waiting for Claude" forever,
// so say so up front.
function manifestPortWarning() {
  if (!MANIFEST_PORTS || MANIFEST_PORTS.includes(PORT)) return null;
  return `Port ${PORT} is not in plugin/manifest.json allowedDomains (${MANIFEST_PORTS.join(", ")}), so Figma will block the plugin. Use one of those ports, or add ws://localhost:${PORT} to the manifest and re-import it.`;
}
const PORT_WARNING = manifestPortWarning();
if (PORT_WARNING) log("[server] " + PORT_WARNING);

function stampPluginUi(token) {
  const template = fs.readFileSync(path.join(here, "plugin", "ui.template.html"), "utf8");
  // Zalando Sans is embedded: the plugin iframe may only reach the local bridge.
  const font = fs.readFileSync(path.join(here, "plugin", "zalando-sans-latin.woff2")).toString("base64");
  // The panel's logo: replace plugin/logo.svg with the brand mark to rebrand the header and the floating button.
  const logoFile = path.join(here, "plugin", "logo.svg");
  const logo = fs.existsSync(logoFile) ? fs.readFileSync(logoFile, "utf8").trim() : "";
  const html = template
    .replaceAll("__BRIDGE_TOKEN__", token)
    .replaceAll("__BRIDGE_PORTS__", JSON.stringify(MANIFEST_PORTS ?? PORTS))
    .replaceAll("__VERSION__", VERSION)
    .replaceAll("__FONT_B64__", font)
    .replaceAll("__LOGO_SVG__", logo);
  const target = path.join(here, "plugin", "ui.html");
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== html) {
    fs.writeFileSync(target, html);
    restrictToOwner(target, log); // it holds the token too
  }
}

// Per-user token in the user's profile (lib/token.js), stamped into the plugin UI on every start.
const token = ensureToken({ legacyDir: here, log });
// Tests run the server on a random port; they must never rewrite the real plugin UI.
if (!process.env.FIGMA_WRITE_NO_STAMP) stampPluginUi(token);

// Lazy bind: the port is claimed on the first tool call, so several Claude sessions can have this
// MCP registered and only the sessions that actually use Figma hold a port (the first free one).
const bridge = new FigmaWriteBridge({ ports: PORTS, token, label: path.basename(process.cwd()) || "Claude", log });
// The panel's Creative tab asks the server to open the isolated browser and read the inbox.
bridge.onPanelRequest = (action, params) => handlePanelRequest(action, params);
if (process.env.FIGMA_WRITE_EAGER === "1") await bridge.start();

// Server instructions reach every client model on connect: this is where the Laya policy, the default colour tokens, the Creative tab and the Mobbin reference rules are taught.
const server = new McpServer(
  { name: "webority-figma-write", version: VERSION },
  { instructions: "Webority Figma MCP: read and write the open Figma file through the local plugin, plus Code Connect, shaders, generative plugins, video and no-seat snapshot reads. Call figma_write_status first and whenever a write fails. Several Figma files can share this session: figma_use_file lists them and picks which one every call goes to. For design critique, run design_review on the frame, then the design_panel or persona_<id> prompts (or design_personas) for judgement.\n\n" + LAYA_RULES + "\n\n" + COLOR_TOKEN_RULES + "\n\n" + CREATIVE_RULES + "\n\n" + REFERENCE_RULES }
);

const text = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
const call = async (command, params, timeoutMs) => {
  try {
    return text(await bridge.request(command, params, timeoutMs));
  } catch (e) {
    return fail(e);
  }
};

server.registerTool(
  "figma_write_status",
  {
    description:
      "Status of the Webority Figma Write bridge: whether the 'Webority Figma MCP' plugin is connected, which file and page it has open, editor type (design editor or Dev Mode), selection count, whether 'Allow edits' is ticked, and plugin vs server version. Call first, and whenever another figma_* write tool fails.",
    annotations: { readOnlyHint: true },
  },
  async () => {
    await bridge.ensureConnected();
    const status = { server: VERSION, ...bridge.status(), ...(PORT_WARNING ? { portWarning: PORT_WARNING } : {}) };
    if (!status.connected) {
      return text({ ...status, hint: bridge.bound ? `Open the 'Webority Figma MCP' plugin in the Figma file you want this session to drive (design editor) and keep it open. A file pairs with a free Claude session, or joins this one when none is free (figma_use_file then picks which file gets the calls); this one is '${bridge.label}' on port ${bridge.port}. Switch in a panel moves that file to another session.` : status.bridge });
    }
    if (status.version && status.version !== VERSION) status.warning = `Plugin build ${status.version} differs from server ${VERSION}. Close and reopen the plugin in Figma.`;
    try {
      return text({ ...status, ...(await bridge.request("status", {}, 10000)) });
    } catch (e) {
      return text({ ...status, statusError: e.message });
    }
  }
);

server.registerTool(
  "figma_use_file",
  {
    description:
      "Several Figma files can be connected to this session at once (open the plugin in each; a file whose panel finds no free session joins this one). Every figma_* call goes to the target file: the first one connected, until this tool picks another by file name or id. Without file: lists the connected files and which is the target. Read-only.",
    inputSchema: { file: z.string().min(1).optional().describe("File name (exact, or a unique part) or id from the list, e.g. 'f2'.") },
    annotations: { readOnlyHint: true },
  },
  async ({ file }) => {
    try {
      await bridge.ensureConnected();
      const files = file ? bridge.useFile(file) : bridge.listFiles();
      if (!files.length) return fail(new Error("No Figma file is connected. Open the 'Webority Figma MCP' plugin in each file you want this session to use."));
      return text({ target: files.find((f) => f.target) || null, files });
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "figma_get_selection_brief",
  {
    description: "Ids, names, types, sizes and parent of the nodes currently selected in Figma. Use it to target edits at 'this one' after the user selects something.",
    annotations: { readOnlyHint: true },
  },
  async () => call("selection_brief", {}, 15000)
);

server.registerTool(
  "figma_export",
  {
    description:
      "Render a node (frame, section, layer) to PNG, JPG or SVG and return it so you can check your work visually. SVG keeps icons and illustrations as vectors. Optionally also save it to a local file. Works in the design editor and Dev Mode; does not need 'Allow edits'.",
    inputSchema: {
      nodeId: z.string().min(1).describe("Node id, e.g. '826:2'. A Figma URL node-id like '826-2' also works."),
      format: z.enum(["PNG", "JPG", "SVG"]).optional().describe("Default PNG."),
      scale: z.number().min(0.05).max(4).optional().describe("Default 1. Use 0.25-0.5 for large frames. Ignored for SVG."),
      savePath: z.string().optional().describe("Absolute local path to also write the file to."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ nodeId, format = "PNG", scale = 1, savePath }) => {
    try {
      prepareSavePath(savePath); // fail on a bad path before the slow render
      const r = await bridge.request("export", { nodeId: normId(nodeId), format, scale }, 90000);
      const bytes = Buffer.from(r.base64, "base64");
      if (savePath) fs.writeFileSync(savePath, bytes);
      const info = { node: r.node, format, width: r.width, height: r.height, bytes: bytes.length, saved: savePath || null };
      // SVG is text, so it comes back as markup rather than an image block.
      if (format === "SVG") return text({ ...info, svg: bytes.toString("utf8").slice(0, 20000) });
      return {
        content: [
          { type: "image", data: r.base64, mimeType: format === "JPG" ? "image/jpeg" : "image/png" },
          { type: "text", text: JSON.stringify(info) },
        ],
      };
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "figma_export_many",
  {
    description:
      "Export many nodes to files in one call, as PNG, JPG or SVG. Returns only a list of what was written, never the images themselves, so it stays cheap for bulk asset extraction (icons, illustrations, screenshots for a rebuild). Does not need 'Allow edits'.",
    inputSchema: {
      items: z
        .array(
          z.object({
            nodeId: z.string().min(1),
            savePath: z.string().min(1).describe("Absolute path to write to. Parent folders are created."),
            format: z.enum(["PNG", "JPG", "SVG"]).optional(),
            scale: z.number().min(0.05).max(4).optional(),
          })
        )
        .min(1)
        .max(500),
      stopOnError: z.boolean().optional().describe("Stop at the first failure. Default false: every item is tried and reported."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ items, stopOnError = false }) => {
    const results = [];
    for (const item of items) {
      try {
        const format = item.format || "PNG";
        prepareSavePath(item.savePath);
        const r = await bridge.request("export", { nodeId: normId(item.nodeId), format, scale: item.scale || 1 }, 90000);
        const bytes = Buffer.from(r.base64, "base64");
        fs.writeFileSync(item.savePath, bytes);
        results.push({ nodeId: item.nodeId, name: r.node && r.node.name, format, width: r.width, height: r.height, bytes: bytes.length, saved: item.savePath });
      } catch (e) {
        results.push({ nodeId: item.nodeId, error: e.message });
        if (stopOnError) break;
      }
    }
    const ok = results.filter((r) => !r.error);
    return text({ exported: ok.length, failed: results.length - ok.length, notTried: items.length - results.length, totalBytes: ok.reduce((n, r) => n + r.bytes, 0), results });
  }
);

server.registerTool(
  "figma_execute",
  {
    description:
      "Run Figma Plugin API JavaScript inside the open file (design editor only, needs 'Allow edits' ticked in the plugin panel). The code runs as the body of an async function: use await, and `return` a value to get it back as JSON (nodes come back as {id,name,type}). The global `figma` is the Plugin API. Load fonts with figma.loadFontAsync before setting text. All changes from one call form a single undo step. Keep each call focused; very large loops freeze Figma until they finish. Note: the Plugin API cannot set OpenType features (e.g. lining figures); copy a layer that already has them and edit its characters instead.",
    inputSchema: {
      code: z.string().min(1).describe("JavaScript body, e.g. `const f = figma.createFrame(); f.name = 'Card'; return f;`"),
      timeoutMs: z.number().int().min(1000).max(120000).optional().describe("Default 30000."),
    },
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ code, timeoutMs = 30000 }) => call("execute", { code, timeoutMs }, timeoutMs + 5000)
);

server.registerTool(
  "figma_set_text",
  {
    description: "Replace the characters of one or more text layers. Fonts used in each layer are loaded automatically. Needs 'Allow edits'. One undo step.",
    inputSchema: {
      edits: z.array(z.object({ nodeId: z.string().min(1), characters: z.string() })).min(1).max(500),
    },
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ edits }) => call("set_text", { edits: edits.map((e) => ({ ...e, nodeId: normId(e.nodeId) })) }, 60000)
);

const specShape = z.lazy(() =>
  z.object({
    type: z.enum(["FRAME", "TEXT", "RECTANGLE", "ELLIPSE"]),
    name: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    fill: z.string().optional().describe("Hex (#FF5733, #FF573380 with alpha), a colour token name (e.g. info-100, bg-light) or 'none'."),
    stroke: z.string().optional().describe("Hex or a colour token name."),
    strokeWeight: z.number().min(0).optional(),
    cornerRadius: z.number().min(0).optional(),
    opacity: z.number().min(0).max(1).optional(),
    clipsContent: z.boolean().optional(),
    layout: z
      .object({
        mode: z.enum(["HORIZONTAL", "VERTICAL"]),
        padding: z.union([z.number(), z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() })]).optional(),
        gap: z.number().optional(),
        primaryAlign: z.enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN", "SPACE_EVENLY", "SPACE_AROUND"]).optional().describe("SPACE_EVENLY / SPACE_AROUND need Figma from Aug 2026."),
        counterAlign: z.enum(["MIN", "CENTER", "MAX", "BASELINE"]).optional(),
        wrap: z.boolean().optional().describe("Wrap children onto new rows (HORIZONTAL) or columns (VERTICAL, Figma from Sep 2026)."),
        wrapGap: z.number().optional().describe("Gap between wrapped rows or columns."),
      })
      .optional(),
    sizing: z
      .object({ horizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(), vertical: z.enum(["FIXED", "HUG", "FILL"]).optional() })
      .optional()
      .describe("FILL needs an auto-layout parent; HUG needs auto layout on this frame or a text node."),
    text: z
      .object({
        characters: z.string(),
        fontFamily: z.string().optional().describe("Default Inter"),
        fontStyle: z.string().optional().describe("Default Regular (omit with variation to let Figma pick the closest instance)"),
        variation: z.record(z.number()).optional().describe("Variable font axes, e.g. {wght: 450} or {wght: 650, wdth: 90}. Figma from Sep 2026."),
        fontName: z.object({ family: z.string(), style: z.string().optional(), variationSettings: z.record(z.number()).optional() }).optional().describe("The fontName shape figma_get_node returns; fontFamily, fontStyle and variation win over it."),
        wrapStyle: z.enum(["AUTO", "BALANCE", "PRETTY"]).optional().describe("BALANCE evens out heading lines; PRETTY avoids a lone last word. Figma from Aug 2026."),
        fontSize: z.number().positive().optional(),
        color: z.string().optional().describe("Hex or a colour token name, e.g. heading or text-2."),
        lineHeight: z.number().positive().optional().describe("Pixels"),
        letterSpacing: z.number().optional().describe("Pixels"),
        align: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
      })
      .optional(),
    children: z.array(specShape).optional(),
  })
);

server.registerTool(
  "figma_create_from_spec",
  {
    description:
      "Build a whole layer tree in one call from a JSON spec: frames with auto layout (horizontal or vertical wrap, space between/evenly/around), padding, gap, Fill/Hug/Fixed sizing, fills, strokes, radius, and text with font (variable font axes too), size, colour, line height and balanced or pretty wrapping. Placed on the current page (or inside parentId), then selected and zoomed into view. Needs 'Allow edits'. One undo step.",
    inputSchema: {
      spec: specShape,
      parentId: z.string().optional().describe("Frame to append into. Omit for the current page."),
      select: z.boolean().optional().describe("Select and zoom to the result. Default true."),
    },
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  async ({ spec, parentId, select = true }) => {
    // Token names resolve here, so the plugin only ever sees hex.
    let resolved;
    try {
      resolved = resolveSpecColors(spec);
    } catch (e) {
      return fail(e);
    }
    return call("create_from_spec", { spec: resolved, parentId, select }, 60000);
  }
);

server.registerTool(
  "figma_color_tokens",
  {
    description:
      "The default Webority colour tokens: ink (heading, text-1 to text-5, white), surfaces (borders, backgrounds) and the info, warning, success and error scales (-active, -100, -50, -30, -20, -10, -5), each with hex and usage and contrast rules. figma_create_from_spec accepts these names wherever it takes a colour. Use them instead of ad hoc hex.",
    annotations: { readOnlyHint: true },
  },
  async () => text({ source: "Social Media Library colour sheet (Figma node 1080:63)", count: Object.keys(COLOR_TOKENS).length, groups: COLOR_TOKEN_GROUPS, rules: COLOR_TOKEN_RULES })
);

// Code Connect, shaders, generative plugins and video (lib/tools-extra.js).
// Tests point the library at a temp folder so they never touch the real one.
registerExtraTools({ server, bridge, here, text, fail, call, libraryDir: process.env.FIGMA_WRITE_LIBRARY_DIR });

// Structured reads: metadata, document, node, find, text, styles, variables, image (lib/tools-read.js).
registerReadTools({ server, bridge, text, fail, call });

// For people who cannot run the plugin: repo-stored code maps and REST reading (lib/tools-open.js).
registerOpenTools({ server, bridge, text, fail });

// laya_status, laya_decide
registerLayaTools({ server, text, fail });

// design_review, design_personas, persona prompts
registerDesignTools({ server, bridge, text, fail });

// figma_generate_image (lib/tools-image.js)
registerImageTools({ server, bridge, text, fail });

// figma_creative_inbox, figma_creative_place (the Creative tab's inbox)
registerCreativeTools({ server, bridge, text, fail });
registerFeatureTools({ server, bridge, text, fail });

// figma_place_references, prompt design_with_references (Mobbin references board)
registerReferenceTools({ server, bridge, text, fail });

// figma_export_motion, figma_animation_styles, figma_get_css, figma_set_variables (Figma's Jul to Oct 2026 API)
registerFigma2026Tools({ server, bridge, text, fail, call });

await server.connect(new StdioServerTransport());
log(`[webority-figma-write ${VERSION}] MCP server ready (bridge ports ${PORTS.join(",")}, binds the first free one on first use)`);

const shutdown = async () => {
  await bridge.stop();
  process.exit(0);
};
process.stdin.on("close", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
