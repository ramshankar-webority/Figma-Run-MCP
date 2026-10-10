// Figma Draw, Prototype and Motion as MCP tools: figma_draw_style, figma_set_prototype, figma_set_motion.
// Each tool validates here and runs as one plugin command (draw_style, set_prototype, set_motion), so a
// call is one undo step and shows in the panel's activity log. The Plugin API shapes behind them were
// probed live on 28-Sep-2026; tools/live-check-draw.mjs re-checks them against real Figma.

import { z } from "zod";
import { normId } from "./util.js";

export const STRETCH_BRUSHES = ["HEIST", "BLOCKBUSTER", "GRINDHOUSE", "BIOPIC", "SPAGHETTI_WESTERN", "SLASHER", "HARDBOILED", "VERITE", "EPIC", "SCREWBALL", "ROM_COM", "NOIR", "PROPAGANDA", "MELODRAMA", "NEW_WAVE"];
export const SCATTER_BRUSHES = ["BUBBLEGUM", "WITCH_HOUSE", "SHOEGAZE", "HONKY_TONK", "SCREAMO", "DRONE", "DOO_WOP", "SPOKEN_WORD", "VAPORWAVE", "OI"];
export const WIDTH_PROFILES = ["UNIFORM", "WEDGE", "TAPER", "QUARTER_TAPER", "EYE", "MIRRORED_TAPER"];
export const EASING_PRESETS = ["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT", "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK", "GENTLE", "QUICK", "BOUNCY", "SLOW"];
export const MOTION_PROPERTIES = ["CORNER_RADIUS", "STROKE_WEIGHT", "STACK_SPACING", "STACK_PADDING_LEFT", "STACK_PADDING_TOP", "STACK_PADDING_RIGHT", "STACK_PADDING_BOTTOM", "STACK_COUNTER_SPACING", "WIDTH", "HEIGHT", "RECTANGLE_TOP_LEFT_CORNER_RADIUS", "RECTANGLE_TOP_RIGHT_CORNER_RADIUS", "RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS", "RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS", "BORDER_TOP_WEIGHT", "BORDER_BOTTOM_WEIGHT", "BORDER_LEFT_WEIGHT", "BORDER_RIGHT_WEIGHT", "OPACITY", "GRID_ROW_GAP", "GRID_COLUMN_GAP", "TRANSLATION_X", "TRANSLATION_Y", "TRANSLATION_XY", "ROTATION", "SCALE_X", "SCALE_Y", "SCALE_XY", "PATH_TRIM_START", "PATH_TRIM_END"];
export const EFFECT_FIELDS = ["OFFSET_X", "OFFSET_Y", "RADIUS", "SPREAD", "COLOR", "REFRACTION_RADIUS", "SPECULAR_ANGLE", "SPECULAR_INTENSITY", "CHROMATIC_ABERRATION", "SPLAY", "REFRACTION_INTENSITY", "START_RADIUS", "NOISE_SIZE_X", "NOISE_SIZE_Y", "DENSITY", "EFFECT_OPACITY", "SECONDARY_COLOR"];

const hex = z.string().regex(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, "Use #RGB, #RRGGBB or #RRGGBBAA");
const id = z.string().min(1).transform(normId);
// An easing: a preset name, a cubic bezier [x1, y1, x2, y2], or a spring (no initial velocity: Figma rejects it).
const easing = z.union([
  z.enum(EASING_PRESETS),
  z.object({ bezier: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
  z.object({ spring: z.object({ mass: z.number().positive(), stiffness: z.number().positive(), damping: z.number().min(0) }) }),
]);
// Motion (timelines, keyframes, styles) also takes Figma's normalized spring; prototype transitions take only the physical one.
const motionEasing = z.union([easing, z.object({ spring: z.object({ bounce: z.number().min(0).max(1) }) })]);

const effect = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noise"), noiseType: z.enum(["MONOTONE", "DUOTONE", "MULTITONE"]).default("MONOTONE"), density: z.number().min(0).max(1).default(0.5), size: z.number().positive().default(1.5), color: hex.default("#00000040"), secondaryColor: hex.optional().describe("DUOTONE only"), opacity: z.number().min(0).max(1).optional().describe("MULTITONE only") }),
  z.object({ type: z.literal("texture"), size: z.number().positive().default(4), radius: z.number().min(0).default(4), clipToShape: z.boolean().default(true) }),
  z.object({ type: z.literal("glass"), refraction: z.number().default(0.8), depth: z.number().default(20), lightIntensity: z.number().default(0.8), lightAngle: z.number().default(-45), dispersion: z.number().default(0.4), radius: z.number().min(0).default(4) }),
  z.object({ type: z.literal("progressive_blur"), radius: z.number().min(0).default(16), startRadius: z.number().min(0).default(0), start: z.object({ x: z.number(), y: z.number() }).default({ x: 0.5, y: 0 }), end: z.object({ x: z.number(), y: z.number() }).default({ x: 0.5, y: 1 }) }),
  z.object({ type: z.literal("shader"), id: z.string().optional(), copyFromNodeId: id.optional().describe("A layer that already uses the shader effect (apply one by hand once; code cannot import shaders)."), properties: z.record(z.any()).optional() }),
]);

const trigger = z.union([
  z.enum(["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG", "ON_MEDIA_END"]),
  z.object({ type: z.enum(["MOUSE_ENTER", "MOUSE_LEAVE", "MOUSE_UP", "MOUSE_DOWN"]), delay: z.number().min(0).default(0) }),
  z.object({ type: z.literal("AFTER_TIMEOUT"), timeout: z.number().positive() }),
  z.object({ type: z.literal("ON_KEY_DOWN"), keyCodes: z.array(z.number().int()).min(1), device: z.string().default("KEYBOARD") }),
]);

const transition = z.object({
  type: z.enum(["INSTANT", "DISSOLVE", "SMART_ANIMATE", "SCROLL_ANIMATE", "MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"]).default("DISSOLVE"),
  direction: z.enum(["LEFT", "RIGHT", "TOP", "BOTTOM"]).optional().describe("MOVE_IN / MOVE_OUT / PUSH / SLIDE_IN / SLIDE_OUT"),
  matchLayers: z.boolean().optional(),
  duration: z.number().min(0).max(10).default(0.3),
  easing: easing.default("EASE_OUT"),
});

const action = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["navigate", "overlay", "swap", "scroll_to", "change_to"]), destinationId: id, preserveScrollPosition: z.boolean().optional() }),
  z.object({ type: z.enum(["back", "close"]) }),
  z.object({ type: z.literal("url"), url: z.string().url(), openInNewTab: z.boolean().default(true) }),
]);

const keyValue = z.union([z.number(), z.object({ x: z.number(), y: z.number() }), hex, z.boolean()]);

export function registerFeatureTools({ server, bridge, text, fail }) {
  const call = async (command, params, timeoutMs = 60000) => {
    try {
      return text(await bridge.request(command, params, timeoutMs));
    } catch (e) {
      return fail(e);
    }
  };

  server.registerTool(
    "figma_draw_style",
    {
      description:
        "Figma Draw styling on existing layers: brush strokes (15 stretch and 10 scatter brushes with their settings), the pencil's wobbly DYNAMIC stroke, variable-width strokes (6 profiles or custom points), stroke colour and weight, effects (noise, texture, glass, progressive blur, a shader effect copied from a layer that already uses it), text on a path, and boolean operations (union, subtract, intersect, exclude, flatten). Lasso, shape builder and pattern fills have no Plugin API. Needs 'Allow edits'. One undo step.",
      inputSchema: {
        nodeIds: z.array(id).min(1).max(200).describe("Layers to style. Strokes and text paths need vectors or shapes with a stroke."),
        stroke: z
          .object({
            brush: z.object({ type: z.enum(["STRETCH", "SCATTER"]), name: z.string().describe("STRETCH: " + STRETCH_BRUSHES.join(", ") + ". SCATTER: " + SCATTER_BRUSHES.join(", ")), direction: z.enum(["FORWARD", "BACKWARD"]).optional().describe("STRETCH only"), gap: z.number().min(0).optional(), wiggle: z.number().min(0).optional(), angularJitter: z.number().optional(), rotation: z.number().optional(), sizeJitter: z.number().min(0).optional() }).optional(),
            dynamic: z.object({ frequency: z.number().default(0.75), wiggle: z.number().default(0.3), smoothen: z.number().default(0.5) }).optional().describe("Hand-drawn wobble (the pencil)."),
            basic: z.boolean().optional().describe("true resets brush or wobble to a plain stroke."),
            width: z.object({ profile: z.enum([...WIDTH_PROFILES, "CUSTOM"]), points: z.array(z.object({ position: z.number().min(0).max(1), width: z.number().min(0) })).optional().describe("CUSTOM: width multipliers along the path") }).optional(),
            color: hex.optional(),
            weight: z.number().min(0).optional(),
          })
          .optional(),
        effects: z.array(effect).max(8).optional(),
        effectsMode: z.enum(["replace", "add"]).default("replace"),
        textPath: z.object({ text: z.string().min(1), fontFamily: z.string().default("Inter"), fontStyle: z.string().default("Regular"), fontSize: z.number().positive().default(18), color: hex.optional() }).optional().describe("Turns the first vector into text that follows its curve (the vector is consumed)."),
        boolean: z.object({ op: z.enum(["union", "subtract", "intersect", "exclude", "flatten"]), fill: hex.optional().describe("Boolean results do not keep their parts' colours; set one here."), name: z.string().optional() }).optional().describe("Combine nodeIds (first layer is the base for subtract)."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async (params) => {
      if (params.stroke?.brush) {
        const names = params.stroke.brush.type === "STRETCH" ? STRETCH_BRUSHES : SCATTER_BRUSHES;
        if (!names.includes(params.stroke.brush.name)) return fail(new Error(`Unknown ${params.stroke.brush.type} brush '${params.stroke.brush.name}'. Use one of: ${names.join(", ")}.`));
      }
      if (params.effects?.some((e) => e.type === "shader" && !e.id && !e.copyFromNodeId)) return fail(new Error("A shader effect needs id or copyFromNodeId (a layer that already uses the shader)."));
      return call("draw_style", params);
    }
  );

  server.registerTool(
    "figma_set_prototype",
    {
      description:
        "Build prototype interactions in the open file: links from a layer (every trigger: click, hover, press, drag, mouse enter/leave/up/down with delay, after a timeout, key press, video end; actions: navigate, open overlay, swap, scroll to, change to a variant, back, close, open a link; transitions: instant, dissolve, smart animate, scroll animate, move/push/slide in or out from any side; easings: 11 presets, cubic bezier, spring), flow starting points, scrolling frames with fixed top layers, and clearing links. Hover and press need CHANGE_TO (on variants) or an overlay, not back. For variables and if/else logic pass raw Plugin API reactions in 'raw'. Overlay position and background, sticky layers and pressing Play have no Plugin API. Needs 'Allow edits'. One undo step.",
      inputSchema: {
        links: z
          .array(
            z.object({
              sourceId: id,
              trigger: trigger.default("ON_CLICK"),
              actions: z.array(action).min(1).max(10),
              transition: transition.optional(),
              replace: z.boolean().default(true).describe("true replaces the layer's links; false adds to them."),
            })
          )
          .max(200)
          .optional(),
        raw: z.array(z.object({ sourceId: id, reactions: z.array(z.any()) })).max(50).optional().describe("Plugin API Reaction objects set as-is, for SET_VARIABLE, SET_VARIABLE_MODE and CONDITIONAL."),
        flows: z.array(z.object({ nodeId: id, name: z.string().min(1) })).optional().describe("Replaces the page's flow starting points."),
        scroll: z.array(z.object({ frameId: id, overflow: z.enum(["NONE", "HORIZONTAL", "VERTICAL", "BOTH"]).optional(), fixedChildren: z.number().int().min(0).optional().describe("The top N layers stay fixed while the frame scrolls.") })).optional(),
        clear: z.array(id).optional().describe("Layers whose links are removed."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async (params) => call("set_prototype", params)
  );

  server.registerTool(
    "figma_set_motion",
    {
      description:
        "Figma Motion (timeline animation) on layers: list the 7 animation presets and their settings (listPresets), apply presets (Position, Scale, Rotation, Size, Opacity, Path, TextStagger for text layers) with custom settings, add keyframe tracks (30 properties such as TRANSLATION_X, ROTATION, SCALE_XY, OPACITY, WIDTH, CORNER_RADIUS, PATH_TRIM_END; a fill colour; or an effect value such as blur RADIUS), with an easing per keyframe, set the timeline length, or clear a layer's motion. Values: numbers, {x,y} for TRANSLATION_XY and SCALE_XY, hex for colours. Figma plays the timeline; the playhead cannot be moved and exports show the resting state. Needs 'Allow edits' except for listPresets. One undo step.",
      inputSchema: {
        listPresets: z.boolean().optional().describe("Only return the presets, their descriptions and settings."),
        nodeIds: z.array(id).max(200).optional(),
        presets: z
          .array(z.object({ preset: z.enum(["Position", "Scale", "Rotation", "Size", "Opacity", "Path", "TextStagger"]), settings: z.record(z.any()).default({}).describe("e.g. Position {type:'slide_in', direction:'bottom', distance:120, duration:0.8, delay:0, easing:'EASE_OUT_BACK'}") }))
          .optional(),
        keyframes: z
          .array(
            z.object({
              property: z.enum(MOTION_PROPERTIES).optional(),
              fillIndex: z.number().int().min(0).optional().describe("Animate the colour of this fill instead of a property."),
              effect: z.object({ index: z.number().int().min(0), field: z.enum(EFFECT_FIELDS) }).optional().describe("Animate a value of this effect."),
              keys: z.array(z.object({ time: z.number().min(0), value: keyValue, easing: motionEasing.optional() })).min(1),
            })
          )
          .optional(),
        timelineSeconds: z.number().positive().max(600).optional().describe("Length of the timeline of each layer's top frame."),
        clear: z.boolean().optional().describe("Remove all presets and keyframe tracks from nodeIds first."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async (params) => {
      if (!params.listPresets && !params.nodeIds?.length) return fail(new Error("Give nodeIds, or listPresets: true."));
      for (const k of params.keyframes || []) {
        const targets = [k.property, k.fillIndex != null, k.effect].filter(Boolean).length;
        if (targets !== 1) return fail(new Error("Each keyframes entry needs exactly one of property, fillIndex or effect."));
      }
      return call("set_motion", params);
    }
  );
}
