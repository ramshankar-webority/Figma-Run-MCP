// Structured read tools: the design data Claude needs to understand or rebuild a file.
// Everything here is read only, works in Dev Mode, and never needs "Allow edits".

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadSnapshot, metadata, findById, prune, findNodes, texts, pathOf, saveSnapshot, defaultSnapshotPath } from "./snapshot.js";
import { readStore, snippetFor } from "./code-map-repo.js";
import { normId, mappingKeys, prepareSavePath } from "./util.js";

export function registerReadTools({ server, bridge, text, fail, call }) {
  // Every read tool takes an optional snapshot. With one, the answer comes from a saved design file:
  // no Figma, no plugin, no seat. Without one, it goes to the live plugin as usual.
  const snapArg = z
    .string()
    .optional()
    .describe("Absolute path to a design snapshot saved by figma_save_snapshot. With this the tool reads the saved design and needs no Figma access at all.");
  const fromSnapshot = (file, fn) => {
    try {
      return text(fn(loadSnapshot(file)));
    } catch (e) {
      return fail(e);
    }
  };
  // A developer on a view-only seat often cannot reach the plugin at all. When no snapshot is named
  // and no plugin is connected, fall back to the snapshot sitting in their project.
  const pick = async (snapshot) => {
    if (snapshot) return snapshot;
    if (await bridge.ensureConnected()) return null;
    return defaultSnapshotPath(process.env, process.cwd());
  };
  const nodeIdArg = z.string().min(1).describe("Node id, e.g. '826:2'. A Figma URL node-id like '826-2' also works.");
  const pageArg = z.string().optional().describe("Page id. Omit for the current page.");

  server.registerTool(
    "figma_get_metadata",
    {
      description: "Cheap overview of the open file: every page with its id, layer count and top-level frames. Start here, then read one page or node in detail.",
      inputSchema: { snapshot: snapArg },
      annotations: { readOnlyHint: true },
    },
    async ({ snapshot }) => { const snap = await pick(snapshot); return snap ? fromSnapshot(snap, (s) => metadata(s)) : call("get_metadata", {}, 60000); }
  );

  server.registerTool(
    "figma_get_document",
    {
      description:
        "The layer tree of a page with layout, sizing, fills, strokes, radius, effects, text, style links, bound variables and component properties. Use depth to control how deep it goes; large pages are truncated at maxNodes.",
      inputSchema: {
        pageId: pageArg.describe("Page id, or omit for the current page."),
        depth: z.number().int().min(0).max(20).optional().describe("How many levels below the page. Default 3."),
        maxNodes: z.number().int().min(1).max(5000).optional().describe("Stop after this many nodes. Default 1500."),
        includeHidden: z.boolean().optional().describe("Include hidden layers. Default true."),
        snapshot: snapArg,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pageId, depth = 3, maxNodes = 1500, includeHidden, snapshot }) => {
      const snap = await pick(snapshot);
      return snap
        ? fromSnapshot(snap, (s) => {
            const counter = { n: 0 };
            const document = prune(s.root, depth, counter, maxNodes); // counts as it goes, so run it first
            return { source: "snapshot", savedAt: s.savedAt, nodes: counter.n, document };
          })
        : call("get_document", { pageId, depth, maxNodes, includeHidden }, 120000);
    }
  );

  server.registerTool(
    "figma_get_node",
    {
      description:
        "One layer in full: position, size, Fill/Hug/Fixed sizing, min and max, constraints, auto layout, fills and strokes with hex, per-corner radius, effects, blend mode, text metrics (line height, letter spacing, case, mixed runs), style links by name, bound variables by name, component and variant properties, the main component behind an instance, and prototype links.",
      inputSchema: {
        nodeId: nodeIdArg,
        depth: z.number().int().min(0).max(20).optional().describe("Levels of children. Default 4."),
        maxNodes: z.number().int().min(1).max(5000).optional().describe("Default 1500."),
        includeHidden: z.boolean().optional(),
        snapshot: snapArg,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ nodeId, depth = 4, maxNodes = 1500, includeHidden, snapshot }) => {
      const snap = await pick(snapshot);
      return snap
        ? fromSnapshot(snap, (s) => {
            const { node, parent } = findById(s, normId(nodeId));
            if (!node) throw new Error("Node not found in snapshot: " + nodeId);
            const counter = { n: 0 };
            const out = prune(node, depth, counter, maxNodes);
            return { source: "snapshot", savedAt: s.savedAt, nodes: counter.n + 1, path: pathOf(s, node.id), parent: parent ? { id: parent.id, name: parent.name, type: parent.type } : null, node: out };
          })
        : call("get_node", { nodeId: normId(nodeId), depth, maxNodes, includeHidden }, 120000);
    }
  );

  server.registerTool(
    "figma_find_nodes",
    {
      description: "Find layers by name, type or text content, with their page and layer path. Use it to locate something before reading or editing it.",
      inputSchema: {
        name: z.string().optional().describe("Match on layer name. Substring by default, case insensitive."),
        regex: z.boolean().optional().describe("Treat name as a regular expression."),
        text: z.string().optional().describe("Match text layers containing this string."),
        types: z.array(z.string()).optional().describe("Node types, e.g. ['FRAME','TEXT','COMPONENT','INSTANCE']."),
        pageId: z.string().optional().describe("Page id, or 'all' for every page. Default: current page."),
        limit: z.number().int().min(1).max(1000).optional().describe("Default 200."),
        snapshot: snapArg,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ snapshot, ...a }) => { const snap = await pick(snapshot); return snap ? fromSnapshot(snap, (s) => findNodes(s, a)) : call("find_nodes", a, 120000); }
  );

  server.registerTool(
    "figma_get_text",
    {
      description: "Every text layer in a page or under one node, with its content, font, size, line height, letter spacing, colour, text style and layer path. Good for copy reviews and translation.",
      inputSchema: {
        nodeId: z.string().optional().describe("Read only inside this node."),
        pageId: z.string().optional().describe("Page id, or 'all'. Ignored when nodeId is given. Default: current page."),
        limit: z.number().int().min(1).max(2000).optional().describe("Default 500."),
        withStyle: z.boolean().optional().describe("Include font and colour details. Default true."),
        snapshot: snapArg,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ nodeId, pageId, limit, withStyle, snapshot }) => {
      const snap = await pick(snapshot);
      return snap
        ? fromSnapshot(snap, (s) => texts(s, { nodeId: nodeId ? normId(nodeId) : undefined, limit, withStyle }))
        : call("get_text", { nodeId: nodeId ? normId(nodeId) : undefined, pageId, limit, withStyle }, 120000);
    }
  );

  server.registerTool(
    "figma_get_styles",
    {
      description: "The file's local styles: paint styles with hex colours and gradients, text styles with full metrics, effect styles and layout grids.",
      inputSchema: { snapshot: snapArg },
      annotations: { readOnlyHint: true },
    },
    async ({ snapshot }) => {
      const snap = await pick(snapshot);
      return snap
        ? fromSnapshot(snap, (s) => {
            if (!s.styles) throw new Error("This snapshot has no styles. Re-save it with includeStyles true.");
            return { source: "snapshot", savedAt: s.savedAt, ...s.styles };
          })
        : call("get_styles", {}, 60000);
    }
  );

  server.registerTool(
    "figma_get_variable_defs",
    {
      description: "The file's local variable collections: every mode, each variable's type, scopes and value per mode, with aliases resolved to the variable they point at and colours as hex.",
      inputSchema: { snapshot: snapArg },
      annotations: { readOnlyHint: true },
    },
    async ({ snapshot }) => {
      const snap = await pick(snapshot);
      return snap
        ? fromSnapshot(snap, (s) => {
            if (!s.variables) throw new Error("This snapshot has no variables. Re-save it with includeVariables true.");
            return { source: "snapshot", savedAt: s.savedAt, ...s.variables };
          })
        : call("get_variable_defs", {}, 60000);
    }
  );

  server.registerTool(
    "figma_save_snapshot",
    {
      description:
        "Save the whole design to one JSON file so it can be read later with no Figma at all. Run this once, from a machine that can open the file in the plugin; teammates on a free or view-only seat then pass `snapshot` to figma_get_metadata, figma_get_node, figma_find_nodes, figma_get_text, figma_get_styles and figma_get_variable_defs and get the same answers offline.",
      inputSchema: {
        savePath: z.string().min(1).describe("Absolute path for the snapshot JSON, e.g. C:/repo/.figma/design-snapshot.json"),
        nodeId: z.string().optional().describe("Save one frame or section. Omit to save the current page."),
        pageId: z.string().optional().describe("Save this page instead of the current one. Ignored when nodeId is given."),
        depth: z.number().int().min(1).max(20).optional().describe("How deep to capture. Default 20, the whole tree."),
        maxNodes: z.number().int().min(1).max(5000).optional().describe("Default 5000."),
        includeStyles: z.boolean().optional().describe("Also capture local styles. Default true."),
        includeVariables: z.boolean().optional().describe("Also capture variable collections. Default true."),
        codeMapRepo: z.string().optional().describe("Repo folder whose .figma/code-map.json should be baked in, so readers see the code mappings too."),
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async ({ savePath, nodeId, pageId, depth = 20, maxNodes = 5000, includeStyles = true, includeVariables = true, codeMapRepo }) => {
      try {
        if (!path.isAbsolute(savePath)) throw new Error("savePath must be absolute.");
        const captured = nodeId
          ? await bridge.request("get_node", { nodeId: normId(nodeId), depth, maxNodes }, 180000)
          : await bridge.request("get_document", { pageId, depth, maxNodes }, 180000);
        const root = captured.node || captured.document;
        const payload = { root, fileName: null, pages: null, styles: null, variables: null, codeMap: null };
        try {
          const meta = await bridge.request("get_metadata", {}, 60000);
          payload.fileName = meta.file;
          payload.pages = meta.pages.map((p) => ({ id: p.id, name: p.name, childCount: p.childCount }));
        } catch (e) {
          payload.metadataError = e.message;
        }
        if (includeStyles) {
          try {
            payload.styles = await bridge.request("get_styles", {}, 60000);
          } catch (e) {
            payload.stylesError = e.message;
          }
        }
        if (includeVariables) {
          try {
            payload.variables = await bridge.request("get_variable_defs", {}, 60000);
          } catch (e) {
            payload.variablesError = e.message;
          }
        }
        // Mappings saved in the file come first; the repo's override them (they are the reviewed copy).
        try {
          const listed = await bridge.request("components", { pageId: "all", mappedOnly: true }, 120000);
          for (const c of listed.components || []) {
            if (!c.mapping) continue;
            payload.codeMap = payload.codeMap || {};
            payload.codeMap[c.id] = { name: c.name, ...c.mapping };
          }
        } catch (e) {
          payload.codeMapError = e.message;
        }
        if (codeMapRepo) {
          const mapFile = path.join(codeMapRepo, ".figma", "code-map.json");
          if (fs.existsSync(mapFile)) payload.codeMap = { ...(payload.codeMap || {}), ...(JSON.parse(fs.readFileSync(mapFile, "utf8")).components || {}) };
        }
        const saved = saveSnapshot(savePath, payload);
        let layers = 0;
        (function count(n) {
          layers++;
          for (const c of n.children || []) count(c);
        })(root);
        return text({
          saved: saved.file,
          bytes: saved.bytes,
          layers,
          figmaFile: payload.fileName,
          styles: Boolean(payload.styles),
          variables: Boolean(payload.variables),
          codeMappings: payload.codeMap ? Object.keys(payload.codeMap).length : 0,
          howToUse: "Pass snapshot: '" + saved.file + "' to any figma_get_* or figma_find_nodes call. No Figma access needed.",
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_snapshot_code_map",
    {
      description: "The code mappings baked into a design snapshot: which Figma component each layer uses and which code component it maps to. Reads the snapshot only, so it works with no Figma access.",
      inputSchema: { snapshot: snapArg.describe("Absolute path to the snapshot JSON."), nodeId: z.string().optional().describe("Only the mapping that applies to this layer.") },
      annotations: { readOnlyHint: true },
    },
    async ({ snapshot, nodeId }) => {
      // Snapshot only, whether or not a plugin is connected.
      const snap = snapshot || defaultSnapshotPath(process.env, process.cwd());
      if (!snap) return fail(new Error("Give a snapshot path, or save one with figma_save_snapshot."));
      return fromSnapshot(snap, (s) => {
        const map = s.codeMap || {};
        if (nodeId) {
          const { node } = findById(s, normId(nodeId));
          if (!node) throw new Error("Node not found in snapshot: " + nodeId);
          const key = mappingKeys(node).find((k) => map[k]);
          return { source: "snapshot", node: { id: node.id, name: node.name, type: node.type }, usesComponent: node.mainComponent || null, mapping: key ? map[key] : null };
        }
        return { source: "snapshot", savedAt: s.savedAt, count: Object.keys(map).length, components: map };
      });
    }
  );

  server.registerTool(
    "figma_save_image",
    {
      description:
        "Save the original bytes of an image fill, at full resolution, rather than a rendering of the layer. Give a nodeId that has an image fill, or an imageHash from figma_get_node. Use figma_export instead when you want the layer as it looks on the canvas.",
      inputSchema: {
        nodeId: z.string().optional().describe("Layer with an image fill."),
        imageHash: z.string().optional().describe("Image hash from a fill in figma_get_node output."),
        fillIndex: z.number().int().min(0).optional().describe("Which image fill on that layer. Default 0."),
        savePath: z.string().optional().describe("Absolute path to write the file to. Without it the image is only returned."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ nodeId, imageHash, fillIndex, savePath }) => {
      try {
        if (!nodeId && !imageHash) throw new Error("Give a nodeId or an imageHash.");
        prepareSavePath(savePath); // fail on a bad path before the slow read
        const r = await bridge.request("get_image", { nodeId: nodeId ? normId(nodeId) : undefined, imageHash, fillIndex }, 90000);
        const bytes = Buffer.from(r.base64, "base64");
        if (savePath) fs.writeFileSync(savePath, bytes);
        // Figma stores PNG, JPEG or GIF bytes; sniff the header so the image renders correctly.
        const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : bytes[0] === 0x47 ? "image/gif" : "image/png";
        return {
          content: [
            { type: "image", data: r.base64, mimeType: mime },
            { type: "text", text: JSON.stringify({ imageHash: r.imageHash, width: r.width, height: r.height, bytes: bytes.length, mimeType: mime, saved: savePath || null }) },
          ],
        };
      } catch (e) {
        return fail(e);
      }
    }
  );
}
