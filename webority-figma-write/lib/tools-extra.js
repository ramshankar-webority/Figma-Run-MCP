// Webority Figma Write 1.1.0 tool families: Code Connect (local), shaders, generative plugins, video.
// Named like the official Figma MCP tools, but everything runs on this PC through the plugin bridge.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { BUILT_IN_SHADERS, EFFECT_PRESETS, MAX_PIXELS, renderPixelShader, validateShader } from "./shaders.js";
import { JsonLibrary, slugify } from "./library.js";
import { scanComponents, suggestMappings, addLayaPicks, CODE_EXTS } from "./code-scan.js";
import { VIDEO_FORMATS, makeFrameDir, writeFrame, encodeVideo } from "./video.js";
import { readStore, snippetFor } from "./code-map-repo.js";
import { loadSnapshot, defaultSnapshotPath, findById, findProjectDir } from "./snapshot.js";
import { normId, mappingKeys, confinedSourcePath } from "./util.js";

export function registerExtraTools({ server, bridge, here, text, fail, call, libraryDir }) {
  const libRoot = libraryDir || path.join(here, "library");
  const nodeIdArg = z.string().min(1).describe("Node id, e.g. '826:2'. A Figma URL node-id like '826-2' also works.");
  const pageArg = z.string().optional().describe("Page id, or 'all' for every page. Default: all pages.");
  const errorsThatStopBatches = /No Figma plugin connected|Edits are off|Dev Mode|Port .* already in use/;

  // ======================== Code Connect (local) ========================
  // Mappings live inside the Figma file (shared plugin data on the component or component set), show in
  // Dev Mode through the plugin's "Webority code map" code generator, and are added as a Dev Mode link when
  // the source is a URL. Works on any Figma plan.

  const mappingShape = {
    nodeId: nodeIdArg.describe("Component, component set, or an instance of one."),
    componentName: z.string().min(1).describe("Code component name, e.g. 'Button'."),
    source: z.string().optional().describe("Where the code lives: a path relative to the codebase root (figma_get_context_for_code_connect reads it only inside sourceDir), or an https URL (URLs are also added as a Dev Mode link)."),
    framework: z.string().optional().describe("React (default), Vue, Svelte, SwiftUI, Compose, Flutter, Razor, HTML..."),
    importPath: z.string().optional().describe("Import specifier, e.g. '@/components/ui/button'."),
    props: z.record(z.string(), z.string()).optional().describe('Figma property name -> code prop name, e.g. {"Size":"size","Label":"children"}. Use "-" to skip a property.'),
    template: z.string().optional().describe("Optional snippet template with {{prop}} placeholders; replaces the generated JSX."),
  };

  server.registerTool(
    "figma_list_file_components_for_code_connect",
    {
      description:
        "List the components and component sets in the open Figma file with their properties, variant options and any existing code mapping. Instances are resolved to the component behind them, so a frame of instances still lists what it uses. Components from a published library are flagged as remote: their mapping has to be saved in the library file.",
      inputSchema: {
        pageId: pageArg,
        nodeId: z.string().optional().describe("Look only inside this frame or section, for example the user's selection."),
        mappedOnly: z.boolean().optional().describe("Only components that already have a code mapping."),
        includeInstances: z.boolean().optional().describe("Resolve instances to their main component. Default true."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pageId = "all", nodeId, mappedOnly = false, includeInstances }) =>
      call("components", { pageId: nodeId ? undefined : pageId, nodeId: nodeId ? normId(nodeId) : undefined, mappedOnly, includeInstances }, 120000)
  );

  server.registerTool(
    "figma_get_code_connect_map",
    {
      description: "Get code mappings. With nodeId: the mapping for that component (instances resolve to their main component) plus a generated code preview. Without nodeId: every mapped component in the file.",
      inputSchema: { nodeId: nodeIdArg.optional(), pageId: pageArg },
      annotations: { readOnlyHint: true },
    },
    async ({ nodeId, pageId = "all" }) => {
      // A developer with view-only access usually has no plugin. Answer from the repo store and the
      // saved snapshot instead, so the same tool works for them.
      if (!(await bridge.ensureConnected())) {
        try {
          const store = readStore(findProjectDir() || process.cwd());
          const snapFile = defaultSnapshotPath(process.env, process.cwd());
          const snap = snapFile ? loadSnapshot(snapFile) : null;
          const fromSnap = snap && snap.codeMap ? snap.codeMap : {};
          const merged = { ...fromSnap, ...store.components };
          if (nodeId) {
            const id = normId(nodeId);
            // Mappings live on the component set, so a variant instance resolves to its set first.
            const node = snap ? findById(snap, id).node : null;
            const key = mappingKeys(node, id).find((k) => merged[k]);
            const mapping = key ? merged[key] : null;
            return text({ source: snapFile ? "repo + snapshot" : "repo", nodeId: id, mapped: Boolean(mapping), mapping, snippet: mapping ? snippetFor(mapping) : null });
          }
          return text({
            source: snapFile ? "repo + snapshot" : "repo",
            note: "No Figma plugin connected, so these come from .figma/code-map.json and the saved snapshot.",
            count: Object.keys(merged).length,
            // Same row shape as the live answer ({id, name, mapping}), so tools/merge-code-connect.mjs reads both.
            components: Object.entries(merged).map(([id, m]) => ({ id, name: m.figmaName || m.name || m.componentName, mapping: m, snippet: snippetFor(m) })),
          });
        } catch (e) {
          return fail(e);
        }
      }
      return nodeId ? call("code_map_get", { nodeId: normId(nodeId) }, 30000) : call("components", { pageId, mappedOnly: true }, 120000);
    }
  );

  server.registerTool(
    "figma_add_code_connect_map",
    {
      description: "Map one Figma component to its code component. Saved in the file and visible to everyone in Dev Mode (choose the 'Webority code map' code generator). Needs 'Allow edits'. One undo step.",
      inputSchema: mappingShape,
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async (m) => {
      if (!(await bridge.ensureConnected())) {
        try {
          const { setMapping } = await import("./code-map-repo.js");
          const { nodeId, ...mapping } = m;
          const r = setMapping(findProjectDir() || process.cwd(), { nodeId: normId(nodeId), mapping });
          return text({ source: "repo", note: "No plugin connected, so the mapping was saved in the repo. Run figma_sync_code_map with direction 'push' from a machine with edit access to put it in the Figma file.", saved: r.file, mapping: r.mapping, snippet: snippetFor(r.mapping) });
        } catch (e) {
          return fail(e);
        }
      }
      return call("code_map_set", { ...m, nodeId: normId(m.nodeId) }, 30000);
    }
  );

  server.registerTool(
    "figma_send_code_connect_mappings",
    {
      description: "Save many component-to-code mappings in one call (for example the accepted results of figma_get_code_connect_suggestions). Each mapping is its own undo step. Needs 'Allow edits'. Reports success or the error for every item.",
      inputSchema: { mappings: z.array(z.object(mappingShape)).min(1).max(300) },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async ({ mappings }) => {
      const results = [];
      for (const m of mappings) {
        try {
          const r = await bridge.request("code_map_set", { ...m, nodeId: normId(m.nodeId) }, 30000);
          results.push({ nodeId: m.nodeId, ok: true, target: r.target, componentName: r.mapping.componentName });
        } catch (e) {
          results.push({ nodeId: m.nodeId, ok: false, error: e.message });
          if (errorsThatStopBatches.test(e.message)) break;
        }
      }
      const saved = results.filter((r) => r.ok).length;
      return text({ saved, failed: results.length - saved, notTried: mappings.length - results.length, results });
    }
  );

  server.registerTool(
    "figma_remove_code_connect_map",
    {
      description: "Remove the code mapping from a component (or the component behind an instance). Needs 'Allow edits'. One undo step.",
      inputSchema: { nodeId: nodeIdArg },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async ({ nodeId }) => call("code_map_remove", { nodeId: normId(nodeId) }, 30000)
  );

  server.registerTool(
    "figma_get_code_connect_suggestions",
    {
      description: "Suggest which code component matches each Figma component. Scans a local source folder (React/TS, Vue, Svelte, Blazor, Razor partials, SwiftUI, Compose, Flutter) and matches by name and prop overlap, with a confidence score. When FIGMA_WRITE_LAYA_URL points at a local Laya server, components without a sure name match also get Laya's pick (method 'laya', uncalibrated confidence), which catches synonyms like Toggle to Switch. Review, then save with figma_send_code_connect_mappings.",
      inputSchema: {
        sourceDir: z.string().min(1).describe("Absolute path to the codebase or its components folder."),
        pageId: pageArg,
        nodeId: z.string().optional().describe("Look only inside this frame or section, for example the user's selection."),
        includeMapped: z.boolean().optional().describe("Also suggest for components that are already mapped. Default false."),
        minConfidence: z.number().min(0).max(1).optional().describe("Default 0.4."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ sourceDir, pageId = "all", nodeId, includeMapped = false, minConfidence = 0.4 }) => {
      try {
        const scan = scanComponents(sourceDir);
        // Instances resolve to the component behind them, so a frame of instances still yields matches.
        const figmaList = await bridge.request("components", { pageId: nodeId ? undefined : pageId, nodeId: nodeId ? normId(nodeId) : undefined, mappedOnly: false }, 120000);
        const targets = figmaList.components.filter((c) => includeMapped || !c.mapping);
        const suggestions = suggestMappings(targets, scan.components, { minConfidence });
        const laya = await addLayaPicks(suggestions, targets, scan.components);
        const used = new Set(suggestions.flatMap((s) => s.candidates.map((c) => c.file + "#" + c.componentName)));
        return text({
          sourceDir,
          scannedFiles: scan.scannedFiles,
          codeComponents: scan.components.length,
          figmaComponents: targets.length,
          matched: suggestions.filter((s) => s.candidates.length).length,
          ...(laya.used ? { laya } : {}),
          suggestions,
          unmatchedCode: scan.components.filter((c) => !used.has(c.file + "#" + c.name)).slice(0, 100).map((c) => `${c.name} (${c.file})`),
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_get_context_for_code_connect",
    {
      description: "Everything needed to map or implement one component: its properties and variants, current mapping and code preview, Dev Mode links, an image of the component, the mapped source file (when it is on this PC), and code match candidates when sourceDir is given.",
      inputSchema: {
        nodeId: nodeIdArg,
        sourceDir: z.string().optional().describe("Codebase folder: resolves relative mapping sources and adds match candidates."),
        includeImage: z.boolean().optional().describe("Default true."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ nodeId, sourceDir, includeImage = true }) => {
      try {
        const ctx = await bridge.request("code_map_get", { nodeId: normId(nodeId) }, 30000);
        const out = { ...ctx };
        const src = ctx.mapping && ctx.mapping.source;
        if (src && !/^https?:\/\//.test(src)) {
          const r = confinedSourcePath(sourceDir, src, CODE_EXTS);
          if (r.file) {
            const code = fs.readFileSync(r.file, "utf8");
            out.sourceFile = { path: r.file, truncated: code.length > 20000, code: code.slice(0, 20000) };
          } else out.sourceFile = { source: src, path: r.path || null, found: false, hint: r.error };
        }
        if (sourceDir && ctx.target) {
          const scan = scanComponents(sourceDir);
          const target = { id: ctx.target.id, name: ctx.target.name, props: ctx.props, mapping: ctx.mapping };
          const suggestions = suggestMappings([target], scan.components, { minConfidence: 0.3, perComponent: 5 });
          const laya = await addLayaPicks(suggestions, [target], scan.components);
          if (laya.used) out.laya = laya;
          out.candidates = suggestions[0].candidates;
        }
        const content = [];
        if (includeImage) {
          try {
            const img = await bridge.request("export", { nodeId: (ctx.target || ctx.node).id, format: "PNG", scale: 1 }, 60000);
            content.push({ type: "image", data: img.base64, mimeType: "image/png" });
          } catch (e) {
            out.imageError = e.message;
          }
        }
        content.push({ type: "text", text: JSON.stringify(out) });
        return { content };
      } catch (e) {
        return fail(e);
      }
    }
  );

  // ======================== Shaders ========================

  const shaderLib = new JsonLibrary(path.join(libRoot, "shaders"), "shader");
  const builtInShader = (id) => BUILT_IN_SHADERS.find((s) => s.id === slugify(id));
  const findShader = (id) => shaderLib.get(id) || builtInShader(id) || null;
  const blendModes = ["NORMAL", "DARKEN", "MULTIPLY", "COLOR_BURN", "LIGHTEN", "SCREEN", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"];

  const pixelShape = z.object({
    code: z.string().min(1).describe("Body of fn(u, v, x, y, width, height, t, params) returning [r,g,b] or [r,g,b,a] with 0-1 channels. u,v run 0..1. Helpers: mix, clamp, smoothstep, step, fract, noise, fbm, hash, hex('#RRGGBB'), mixColor, length, PI, TAU and Math functions."),
    width: z.number().int().min(1).max(MAX_PIXELS).optional().describe("Render width in px. Default 1024."),
    height: z.number().int().min(1).max(MAX_PIXELS).optional().describe("Render height in px. Default 1024."),
  });
  const fillShape = z.object({
    scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional(),
    blendMode: z.enum(blendModes).optional(),
    opacity: z.number().min(0).max(1).optional(),
    mode: z.enum(["replace", "add"]).optional().describe("Replace the layer's fills (default) or add on top."),
  });
  const effectShape = z.object({ preset: z.enum(EFFECT_PRESETS), options: z.record(z.string(), z.any()).optional() });

  const renderShaderImage = (shader, { params = {}, t = 0, width, height } = {}) =>
    shader.pixel
      ? renderPixelShader({ code: shader.pixel.code, width: width || shader.pixel.width || 1024, height: height || shader.pixel.height || 1024, t, params: { ...(shader.params || {}), ...params } })
      : null;
  const shaderPreview = (shader, params) => {
    const w = shader.pixel.width || 1024, h = shader.pixel.height || 1024;
    const png = renderShaderImage(shader, { params, width: 256, height: Math.max(1, Math.round((256 * h) / w)) });
    return { type: "image", data: png.toString("base64"), mimeType: "image/png" };
  };

  server.registerTool(
    "figma_create_shader",
    {
      description: "Create a reusable shader: pixel code (a JavaScript fragment function rendered to an image fill on this PC) and/or native Figma effects (glass, noise, texture, glow, shadow, blurs). Saved in the local shader library; apply it with figma_apply_shader. Returns a preview image when there is pixel code. Does not need Figma open.",
      inputSchema: {
        name: z.string().min(1),
        id: z.string().optional().describe("Slug. Default: from name."),
        description: z.string().optional(),
        pixel: pixelShape.optional(),
        effects: z.array(effectShape).optional(),
        fill: fillShape.optional(),
        params: z.record(z.string(), z.any()).optional().describe("Default parameter values, passed to pixel code as params and merged into effect options."),
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async (a) => {
      try {
        const id = slugify(a.id || a.name);
        if (!id) throw new Error("Give the shader a name with letters or digits.");
        if (builtInShader(id)) throw new Error(`'${id}' is a built-in shader. Pick another id.`);
        if (shaderLib.has(id)) throw new Error(`Shader '${id}' already exists. Use figma_update_shader.`);
        const now = new Date().toISOString();
        const shader = {
          id,
          name: a.name,
          description: a.description || "",
          version: 1,
          pixel: a.pixel || null,
          effects: a.effects || [],
          fill: { scaleMode: "FILL", blendMode: "NORMAL", opacity: 1, mode: "replace", ...(a.fill || {}) },
          params: a.params || {},
          createdAt: now,
          updatedAt: now,
        };
        validateShader(shader);
        const content = shader.pixel ? [shaderPreview(shader)] : [];
        shaderLib.save(shader);
        content.push({ type: "text", text: JSON.stringify({ created: shader }) });
        return { content };
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_get_shader",
    {
      description: "Get one shader (library or built-in) with its code, effects, fill settings and default params, plus a preview image when it has pixel code.",
      inputSchema: {
        id: z.string().min(1),
        preview: z.boolean().optional().describe("Default true."),
        params: z.record(z.string(), z.any()).optional().describe("Preview with these params."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, preview = true, params }) => {
      try {
        const shader = findShader(id);
        if (!shader) throw new Error(`No shader '${id}'. See figma_list_shaders.`);
        const content = preview && shader.pixel ? [shaderPreview(shader, params)] : [];
        content.push({ type: "text", text: JSON.stringify(shader) });
        return { content };
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_update_shader",
    {
      description: "Update a library shader: name, description, pixel code, effects, fill or params. Bumps its version. Layers already using it keep their look until figma_apply_shader runs again (figma_list_file_shaders shows which layers are behind).",
      inputSchema: {
        id: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        pixel: pixelShape.nullable().optional().describe("null removes the pixel part."),
        effects: z.array(effectShape).optional(),
        fill: fillShape.optional(),
        params: z.record(z.string(), z.any()).optional().describe("Replaces the default params."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async (a) => {
      try {
        const current = shaderLib.get(a.id);
        if (!current) throw new Error(builtInShader(a.id) ? `'${a.id}' is built-in and read-only. Create a copy with figma_create_shader.` : `No library shader '${a.id}'.`);
        const next = { ...current };
        for (const k of ["name", "description", "pixel", "effects", "params"]) if (a[k] !== undefined) next[k] = a[k];
        if (a.fill) next.fill = { ...(current.fill || {}), ...a.fill };
        next.version = (current.version || 1) + 1;
        next.updatedAt = new Date().toISOString();
        validateShader(next);
        const content = next.pixel ? [shaderPreview(next)] : [];
        shaderLib.save(next);
        content.push({ type: "text", text: JSON.stringify({ updated: next }) });
        return { content };
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_list_shaders",
    {
      description: "List every shader available: built-in presets (native effects, aurora gradient, film grain) and the local library.",
      inputSchema: { source: z.enum(["all", "library", "built-in"]).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ source = "all" }) => {
      const row = (s) => ({ id: s.id, name: s.name, description: s.description, builtIn: !!s.builtIn, version: s.version, pixel: !!s.pixel, effects: (s.effects || []).map((e) => e.preset), params: s.params });
      const list = [...(source !== "library" ? BUILT_IN_SHADERS : []), ...(source !== "built-in" ? shaderLib.list() : [])].map(row);
      return text({ count: list.length, shaders: list });
    }
  );

  server.registerTool(
    "figma_list_file_shaders",
    {
      description: "List the shaders used in the open Figma file: which layers use each one, with page, params and applied version, and how many layers are behind the library version.",
      inputSchema: { pageId: pageArg },
      annotations: { readOnlyHint: true },
    },
    async ({ pageId = "all" }) => {
      try {
        const r = await bridge.request("shader_usage", { pageId }, 120000);
        for (const s of r.shaders) {
          const lib = findShader(s.id);
          s.inLibrary = !!lib;
          s.libraryVersion = lib ? lib.version : null;
          s.outdatedNodes = lib ? s.nodes.filter((n) => typeof n.version === "number" && n.version < lib.version).length : 0;
        }
        return text(r);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_apply_shader",
    {
      description: "Apply a shader to layers: renders its pixel code to an image fill (at the shader's size, or width/height) and sets its native effects. Each layer remembers the shader, version and params. Needs 'Allow edits'. One undo step.",
      inputSchema: {
        id: z.string().min(1).describe("Shader id from figma_list_shaders."),
        nodeIds: z.array(z.string().min(1)).min(1).max(200),
        params: z.record(z.string(), z.any()).optional().describe("Override default params (also merged into effect options)."),
        t: z.number().optional().describe("Time value for animated pixel code. Default 0."),
        width: z.number().int().min(1).max(MAX_PIXELS).optional(),
        height: z.number().int().min(1).max(MAX_PIXELS).optional(),
        fill: fillShape.optional().describe("Override the shader's fill settings."),
        effectsMode: z.enum(["replace", "add"]).optional().describe("Replace the layer's effects (default) or add to them."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async ({ id, nodeIds, params = {}, t = 0, width, height, fill, effectsMode = "replace" }) => {
      try {
        const shader = findShader(id);
        if (!shader) throw new Error(`No shader '${id}'. See figma_list_shaders.`);
        const merged = { ...(shader.params || {}), ...params };
        const png = renderShaderImage(shader, { params, t, width, height });
        // The shader's effect options are defaults and params given in this call override them. The shader's
        // own pixel defaults (shader.params) stay out, so a pixel 'color' never recolours a glow.
        const effects = (shader.effects || []).map((e) => ({ preset: e.preset, options: { ...(e.options || {}), ...params } }));
        const r = await bridge.request(
          "apply_shader",
          {
            nodeIds: nodeIds.map(normId),
            imageBase64: png ? png.toString("base64") : null,
            fill: { ...(shader.fill || {}), ...(fill || {}) },
            effects,
            effectsMode,
            shader: { id: shader.id, name: shader.name, version: shader.version, params: merged, t },
          },
          120000
        );
        return text(r);
      } catch (e) {
        return fail(e);
      }
    }
  );

  // ======================== Generative plugins ========================
  // A generative plugin is a saved, parameterised Plugin API script: create it once, run it on any file.

  const pluginLib = new JsonLibrary(path.join(libRoot, "generative-plugins"), "generative plugin");
  const paramDef = z.object({
    type: z.enum(["string", "number", "boolean", "color", "json"]).optional(),
    default: z.any().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  });
  const pluginCodeArg = z.string().min(1).describe("Plugin API JavaScript, run like figma_execute (async body, `return` a value). A `params` object holds the run parameters; `figma` is the Plugin API.");

  const checkSyntax = (code) => {
    try {
      new Function("params", "figma", "return (async function(){\n" + code + "\n})");
    } catch (e) {
      throw new Error("Syntax error in plugin code: " + e.message);
    }
  };

  server.registerTool(
    "figma_create_generative_plugin",
    {
      description: "Save a reusable generative plugin: named Plugin API code with declared parameters (for example 'make a 12-column grid' or 'generate avatar placeholders'). Stored in the local library; run it on any open file with figma_run_generative_plugin. Does not need Figma open.",
      inputSchema: {
        name: z.string().min(1),
        id: z.string().optional().describe("Slug. Default: from name."),
        description: z.string().optional(),
        code: pluginCodeArg,
        params: z.record(z.string(), paramDef).optional().describe('Parameter definitions, e.g. {"columns":{"type":"number","default":12}}.'),
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async (a) => {
      try {
        const id = slugify(a.id || a.name);
        if (!id) throw new Error("Give the plugin a name with letters or digits.");
        if (pluginLib.has(id)) throw new Error(`Generative plugin '${id}' already exists. Use figma_update_generative_plugin.`);
        checkSyntax(a.code);
        const now = new Date().toISOString();
        return text({ created: pluginLib.save({ id, name: a.name, description: a.description || "", code: a.code, params: a.params || {}, version: 1, runs: 0, createdAt: now, updatedAt: now }) });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_get_generative_plugin",
    {
      description: "Get one generative plugin with its code, parameters, version and run count.",
      inputSchema: { id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      try {
        const p = pluginLib.get(id);
        if (!p) throw new Error(`No generative plugin '${id}'. See figma_list_generative_plugins.`);
        return text(p);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_update_generative_plugin",
    {
      description: "Update a generative plugin's name, description, code or parameter definitions. Bumps its version.",
      inputSchema: { id: z.string().min(1), name: z.string().optional(), description: z.string().optional(), code: pluginCodeArg.optional(), params: z.record(z.string(), paramDef).optional() },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async (a) => {
      try {
        const current = pluginLib.get(a.id);
        if (!current) throw new Error(`No generative plugin '${a.id}'.`);
        if (a.code !== undefined) checkSyntax(a.code);
        const next = { ...current };
        for (const k of ["name", "description", "code", "params"]) if (a[k] !== undefined) next[k] = a[k];
        next.version = (current.version || 1) + 1;
        next.updatedAt = new Date().toISOString();
        return text({ updated: pluginLib.save(next) });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_list_generative_plugins",
    {
      description: "List the saved generative plugins with their parameters.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const list = pluginLib.list().map((p) => ({ id: p.id, name: p.name, description: p.description, params: p.params, version: p.version, runs: p.runs || 0, updatedAt: p.updatedAt }));
      return text({ count: list.length, plugins: list });
    }
  );

  server.registerTool(
    "figma_run_generative_plugin",
    {
      description: "Run a saved generative plugin on the open Figma file with the given parameters (defaults fill the rest). Needs 'Allow edits'. One undo step.",
      inputSchema: {
        id: z.string().min(1),
        params: z.record(z.string(), z.any()).optional(),
        timeoutMs: z.number().int().min(1000).max(120000).optional().describe("Default 60000."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async ({ id, params = {}, timeoutMs = 60000 }) => {
      try {
        const plugin = pluginLib.get(id);
        if (!plugin) throw new Error(`No generative plugin '${id}'.`);
        const values = { ...params };
        for (const [k, def] of Object.entries(plugin.params || {})) {
          if (values[k] !== undefined) continue;
          if (def.default !== undefined) values[k] = def.default;
          else if (def.required) throw new Error(`Missing required parameter '${k}'${def.description ? ": " + def.description : ""}.`);
        }
        // Same shape checkSyntax compiles: params comes from an outer scope and the plugin body runs in its
        // own function, so a plugin that declares its own `params` shadows it instead of clashing.
        const code = `return await ((params) => (async function () {\n${plugin.code}\n})())(${JSON.stringify(values)});`;
        const r = await bridge.request("execute", { code, timeoutMs }, timeoutMs + 5000);
        const latest = pluginLib.get(id) || plugin;
        pluginLib.save({ ...latest, runs: (latest.runs || 0) + 1, lastRunAt: new Date().toISOString() });
        return text({ plugin: { id: plugin.id, version: plugin.version }, params: values, result: r.result === undefined ? r : r.result, fileName: r.fileName });
      } catch (e) {
        return fail(e);
      }
    }
  );

  // ======================== Video ========================

  server.registerTool(
    "figma_export_video",
    {
      description:
        "Export frames from Figma as an MP4, WebM or GIF saved on this PC. Give frames one of three ways: (1) nodeIds, frames shown in order as a slideshow; (2) parentId, every child of a section or frame in layer order; (3) animate, one node plus JavaScript that changes a temporary copy for each frame (receives node, t from 0 to 1, frame, frames, params) for real motion. Slideshows need no edits; animate needs 'Allow edits' because it creates and deletes a temporary copy off-canvas.",
      inputSchema: {
        savePath: z.string().min(1).describe("Absolute output path. The .mp4, .webm or .gif extension sets the format unless format is given."),
        format: z.enum(VIDEO_FORMATS).optional(),
        nodeIds: z.array(z.string().min(1)).min(1).max(600).optional(),
        parentId: z.string().optional(),
        animate: z
          .object({
            nodeId: z.string().min(1),
            code: z.string().min(1).describe("Async body, e.g. `node.rotation = t * 360;` or `node.findOne(n => n.name === 'Bar').resize(40 + t * 200, 12);`"),
            frames: z.number().int().min(2).max(600).optional().describe("Default: fps x durationSeconds."),
            durationSeconds: z.number().min(0.1).max(60).optional().describe("Default 3."),
            params: z.record(z.string(), z.any()).optional(),
          })
          .optional(),
        frameDurationSeconds: z.number().min(0.05).max(30).optional().describe("Slideshow: how long each frame shows. Default 1."),
        fps: z.number().int().min(1).max(60).optional().describe("Output frame rate. Default 30 (GIF 15)."),
        scale: z.number().min(0.05).max(4).optional().describe("Export scale. Default 1."),
        loop: z.boolean().optional().describe("GIF only. Default true."),
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async (a) => {
      if ([a.nodeIds, a.parentId, a.animate].filter(Boolean).length !== 1) return fail(new Error("Give exactly one of nodeIds, parentId or animate."));
      if (!path.isAbsolute(a.savePath)) return fail(new Error("savePath must be an absolute path."));
      const ext = path.extname(a.savePath).slice(1).toLowerCase();
      const format = a.format || (VIDEO_FORMATS.includes(ext) ? ext : null);
      if (!format) return fail(new Error("Set format, or use a .mp4, .webm or .gif savePath."));
      const fps = a.fps || (format === "gif" ? 15 : 30);
      const scale = a.scale || 1;
      const dir = makeFrameDir();
      try {
        let size = null;
        let count = 0;
        const keep = (base64) => {
          const s = writeFrame(dir, ++count, base64);
          if (!size) size = s;
        };
        let frameRate;
        if (a.animate) {
          const duration = a.animate.durationSeconds || 3;
          const frames = a.animate.frames || Math.max(2, Math.round(fps * duration));
          for (let i = 0; i < frames; i++) {
            const r = await bridge.request("render_frame", { nodeId: normId(a.animate.nodeId), code: a.animate.code, frame: i, frames, params: a.animate.params || {}, scale }, 60000);
            keep(r.base64);
          }
          frameRate = frames / duration;
        } else {
          let ids = a.nodeIds;
          if (a.parentId) {
            const r = await bridge.request("list_children", { parentId: normId(a.parentId) }, 30000);
            ids = r.children.map((c) => c.id);
            if (!ids.length) throw new Error("That container has no children.");
          }
          for (const id of ids) {
            const r = await bridge.request("export", { nodeId: normId(id), format: "PNG", scale }, 90000);
            keep(r.base64);
          }
          frameRate = 1 / (a.frameDurationSeconds || 1);
        }
        return text(await encodeVideo({ dir, frameCount: count, width: size.width, height: size.height, format, frameRate, fps, loop: a.loop !== false, savePath: a.savePath }));
      } catch (e) {
        return fail(e);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  );
}
