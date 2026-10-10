// Figma's July to October 2026 Plugin API additions as MCP tools: figma_export_motion (native MP4/GIF/WEBM),
// figma_animation_styles (custom animation styles), figma_get_css (inspect-panel CSS) and figma_set_variables
// (colour + opacity, easing and timing variables). Plugin commands: export_motion, animation_styles, get_css, set_variables.
// Layout and text additions (vertical wrap, space evenly/around, text wrap style, variable fonts) live in figma_create_from_spec.

import fs from "node:fs";
import { z } from "zod";
import { resolveColor } from "./color-tokens.js";
import { EASING_PRESETS } from "./tools-figma-features.js";
import { normId, prepareSavePath } from "./util.js";

const id = z.string().min(1).transform(normId);
const easing = z.union([
  z.enum(EASING_PRESETS),
  z.object({ bezier: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
  z.object({ spring: z.object({ bounce: z.number().min(0).max(1) }) }).describe("Normalized spring, bounce 0 to 1"),
  z.object({ spring: z.object({ mass: z.number().positive(), stiffness: z.number().positive(), damping: z.number().min(0) }) }),
]);
const MIME = { MP4: "video/mp4", GIF: "image/gif", WEBM: "video/webm" };

// A colour value: hex or colour token name, or "@name" for another variable.
const resolveVarColour = (v) => (typeof v === "string" && v.startsWith("@") ? v : resolveColor(v));

export function registerFigma2026Tools({ server, bridge, text, fail, call }) {
  server.registerTool(
    "figma_export_motion",
    {
      description:
        "Export a top-level frame's Motion animation as MP4, GIF or WEBM, rendered by Figma itself (presets, keyframes and custom animation styles set with figma_set_motion or figma_animation_styles, or by hand). Saves to savePath and returns the size and duration, not the bytes. Capped at 4K. For animations written as code, use figma_export_video. Read-only.",
      inputSchema: {
        nodeId: id.describe("A frame placed directly on a page that has a Motion timeline."),
        savePath: z.string().describe("Absolute path for the file, e.g. C:\\out\\hero.mp4."),
        format: z.enum(["MP4", "GIF", "WEBM"]).default("MP4"),
        fps: z.union([z.literal(8), z.literal(12), z.literal(15), z.literal(24), z.literal(30), z.literal(60)]).optional().describe("MP4/WEBM: 12, 24, 30 (default), 60. GIF: 8, 12, 15 (default), 24, 30."),
        quality: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().describe("MP4/WEBM, default HIGH."),
        loopCount: z.number().int().min(0).max(1000).optional().describe("GIF only; 0 (default) loops forever."),
        scale: z.union([z.literal(0.5), z.literal(0.75), z.literal(1), z.literal(1.5), z.literal(2), z.literal(3), z.literal(4)]).optional(),
        width: z.number().int().positive().optional().describe("Fixed output width in px (instead of scale)."),
        height: z.number().int().positive().optional().describe("Fixed output height in px (instead of scale)."),
      },
      annotations: { readOnlyHint: true },
    },
    async (p) => {
      try {
        prepareSavePath(p.savePath);
        const fpsOk = p.format === "GIF" ? [8, 12, 15, 24, 30] : [12, 24, 30, 60];
        if (p.fps && !fpsOk.includes(p.fps)) throw new Error(`${p.format} takes fps ${fpsOk.join(", ")}.`);
        const { savePath, ...params } = p;
        const r = await bridge.request("export_motion", params, 600000);
        const bytes = Buffer.from(r.base64, "base64");
        fs.writeFileSync(savePath, bytes);
        return text({ saved: savePath, format: r.format, mimeType: MIME[r.format], bytes: bytes.length, duration: r.duration, node: r.node });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_animation_styles",
    {
      description:
        "Reusable Motion animations (custom animation styles). list: Figma's presets with their settings, and the file's custom styles. create: a named style from one or more presets (re-running with the same name adds entries; replace:true rebuilds it). apply: put a style on layers, with an optional start offset and a per-layer stagger. delete: remove a style. Writes need 'Allow edits'. One undo step.",
      inputSchema: {
        action: z.enum(["list", "create", "apply", "delete"]),
        name: z.string().min(1).optional().describe("create: the style name."),
        description: z.string().optional().describe("create: shown in Figma's style picker."),
        entries: z
          .array(z.object({ preset: z.string().min(1).describe("Preset name or id from list, e.g. Opacity, Position, Scale."), settings: z.record(z.any()).default({}).describe("Preset settings from list, e.g. {direction:'bottom', distance:80, duration:0.6, easing:'EASE_OUT_BACK'}") }))
          .max(20)
          .optional(),
        replace: z.boolean().optional().describe("create: clear an existing style's entries first."),
        style: z.string().optional().describe("apply/delete: style name or id."),
        nodeIds: z.array(id).max(500).optional().describe("apply: layers inside a top-level frame."),
        timelineOffset: z.number().min(0).optional().describe("apply: start time in seconds."),
        stagger: z.number().min(0).optional().describe("apply: extra seconds per layer, in nodeIds order."),
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async (p) => {
      if (p.action === "create" && (!p.name || !p.entries?.length)) return fail(new Error("create needs name and at least one entry."));
      if ((p.action === "apply" || p.action === "delete") && !p.style) return fail(new Error(p.action + " needs style."));
      if (p.action === "apply" && !p.nodeIds?.length) return fail(new Error("apply needs nodeIds."));
      return call("animation_styles", p, 120000);
    }
  );

  server.registerTool(
    "figma_get_css",
    {
      description:
        "The CSS Figma's inspect panel shows for layers (layout, size, colours, type, effects), straight from Figma. Use for design-to-code. Defaults to the selection; depth walks into children. Read-only.",
      inputSchema: {
        nodeIds: z.array(id).max(100).optional(),
        depth: z.number().int().min(0).max(10).optional().describe("0 (default) = only the given layers."),
        maxNodes: z.number().int().min(1).max(1000).optional().describe("Default 200."),
      },
      annotations: { readOnlyHint: true },
    },
    async (p) => call("get_css", p, 120000)
  );

  const colourValue = z.union([
    z.string().describe("Hex, colour token name (info-100), or @name of another variable."),
    z.object({ color: z.string().describe("Hex, token or @variable"), opacity: z.union([z.number().min(0).max(1), z.string()]).describe("0 to 1, or @variable") }).describe("Colour + opacity; the colour or the opacity must be a @variable."),
  ]);
  server.registerTool(
    "figma_set_variables",
    {
      description:
        "Create or update local variables in one call, in a collection (created if missing) and mode (added if missing; default the first). Types: COLOR (hex, colour token name, or colour + opacity where one side is a variable), FLOAT, STRING, BOOLEAN, EASING (Motion easing: preset, bezier or spring) and TIMING (seconds). A value '@name' aliases another variable ('@Collection::name' across collections). Optional scopes, e.g. COLOR_OPACITY, ALL_FILLS, GAP. Needs 'Allow edits'. One undo step.",
      inputSchema: {
        collection: z.string().min(1),
        mode: z.string().optional(),
        variables: z
          .array(
            z.discriminatedUnion("type", [
              z.object({ type: z.literal("COLOR"), name: z.string().min(1), value: colourValue, scopes: z.array(z.string()).optional(), description: z.string().optional() }),
              z.object({ type: z.literal("FLOAT"), name: z.string().min(1), value: z.union([z.number(), z.string()]), scopes: z.array(z.string()).optional(), description: z.string().optional() }),
              z.object({ type: z.literal("STRING"), name: z.string().min(1), value: z.string(), scopes: z.array(z.string()).optional(), description: z.string().optional() }),
              z.object({ type: z.literal("BOOLEAN"), name: z.string().min(1), value: z.union([z.boolean(), z.string()]), scopes: z.array(z.string()).optional(), description: z.string().optional() }),
              z.object({ type: z.literal("EASING"), name: z.string().min(1), value: z.union([easing, z.string()]), scopes: z.array(z.string()).optional(), description: z.string().optional() }),
              z.object({ type: z.literal("TIMING"), name: z.string().min(1), value: z.union([z.number().min(0), z.string()]).describe("Seconds"), scopes: z.array(z.string()).optional(), description: z.string().optional() }),
            ])
          )
          .min(1)
          .max(500),
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async (p) => {
      let variables;
      try {
        // Token names resolve here, so the plugin only ever sees hex or @aliases.
        variables = p.variables.map((v) => {
          if (v.type !== "COLOR") return v;
          if (typeof v.value === "string") return { ...v, value: resolveVarColour(v.value) };
          return { ...v, value: { color: resolveVarColour(v.value.color), opacity: v.value.opacity } };
        });
      } catch (e) {
        return fail(e);
      }
      return call("set_variables", { ...p, variables }, 120000);
    }
  );
}
