// Tools for people who cannot run the Figma plugin: a free or view-only seat, or anyone without
// Figma open at all. Two families:
//   repo code map  - Code Connect mappings stored in the repo, no Figma rights needed
//   REST reading   - read a file with the reader's own personal access token, heavily cached

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { readStore, setMapping, removeMapping, snippetFor, storePath } from "./code-map-repo.js";
import { FigmaRest, tokenFrom, parseFileRef } from "./rest.js";
import { loadSnapshot, defaultSnapshotPath , findProjectDir } from "./snapshot.js";

export function registerOpenTools({ server, bridge, text, fail }) {
  const repoArg = z.string().min(1).describe("Absolute path to the repo or project folder that owns the mappings.");
  const mappingShape = {
    componentName: z.string().min(1).describe("Code component name, e.g. 'AppButton'."),
    source: z.string().optional().describe("Path or URL to the code."),
    framework: z.string().optional().describe("React (default), React Native, Vue, Razor, SwiftUI..."),
    importPath: z.string().optional(),
    props: z.record(z.string(), z.string()).optional().describe("Figma property name -> code prop name. '-' skips one."),
    template: z.string().optional().describe("Snippet template with {{prop}} placeholders."),
  };

  server.registerTool(
    "figma_access_check",
    {
      description:
        "What this machine can do with Figma right now, and what to do about it. Reports whether the plugin is connected and whether it can edit, whether a design snapshot is available, whether a REST token is present with how much of the monthly budget is left, and whether repo code mappings exist. Written for developers on a free or view-only seat: it names the route that works for them.",
      inputSchema: { repoDir: z.string().optional().describe("Project folder to check for .figma/design-snapshot.json, .figma/code-map.json and .figma/token.") },
      annotations: { readOnlyHint: true },
    },
    async ({ repoDir }) => {
      const dir = repoDir || findProjectDir() || process.cwd();
      const status = bridge.status();
      const snapFile = defaultSnapshotPath(process.env, dir);
      let snapshot = null;
      if (snapFile) {
        try {
          const s = loadSnapshot(snapFile);
          let layers = 0;
          (function count(n) {
            layers++;
            for (const c of n.children || []) count(c);
          })(s.root);
          snapshot = { file: snapFile, savedAt: s.savedAt, figmaFile: s.fileName, layers, styles: Boolean(s.styles), variables: Boolean(s.variables), mappings: s.codeMap ? Object.keys(s.codeMap).length : 0 };
        } catch (e) {
          snapshot = { file: snapFile, error: e.message };
        }
      }
      const { token, source, warning: tokenWarning } = tokenFrom(process.env, dir);
      const rest = new FigmaRest({ token, cacheDir: process.env.FIGMA_REST_CACHE });
      const usage = rest.usage();
      const repoMap = readStore(dir);
      const routes = [];
      if (status.connected) routes.push(status.editsAllowed ? "Plugin connected with edits allowed: every tool works, reads and writes." : "Plugin connected, read only: all read tools and Code Connect reads work. Ticking 'Allow edits' adds the write tools.");
      if (snapshot && !snapshot.error) routes.push("Snapshot found: read tools answer from it with no Figma at all. Pass snapshot, or let it be picked up automatically.");
      if (token) routes.push("REST token found: figma_rest_file and figma_rest_images work. View and Collab seats get about 20 file or image requests a month, and " + usage.calls + " have been used this month on this machine.");
      if (Object.keys(repoMap.components).length) routes.push(Object.keys(repoMap.components).length + " code mappings in the repo: figma_get_code_connect_map reads them with no Figma access.");
      if (!routes.length) routes.push("Nothing available yet. Ask a teammate with file access to run figma_save_snapshot into this repo's .figma folder, or add your own token with FIGMA_TOKEN.");
      return text({
        plugin: { connected: status.connected, file: status.fileName || null, editorType: status.editorType || null, editsAllowed: status.editsAllowed ?? null },
        snapshot,
        rest: { tokenFound: Boolean(token), tokenSource: source, ...(tokenWarning ? { tokenWarning } : {}), callsThisMonth: usage.calls, seatNote: "Free, View and Collab seats: about 20 file or image requests a month." },
        repoCodeMap: { file: storePath(dir), mappings: Object.keys(repoMap.components).length },
        worksForYou: routes,
      });
    }
  );

  server.registerTool(
    "figma_get_repo_code_map",
    {
      description:
        "Read the Code Connect mappings stored in a repo (.figma/code-map.json). Needs no Figma access at all, so a teammate on a free or view-only seat can use it. Returns each component's mapping and the snippet it generates.",
      inputSchema: { repoDir: repoArg, nodeId: z.string().optional().describe("One component only.") },
      annotations: { readOnlyHint: true },
    },
    async ({ repoDir, nodeId }) => {
      try {
        const store = readStore(repoDir);
        const rows = Object.entries(store.components)
          .filter(([id]) => !nodeId || id === nodeId)
          .map(([id, m]) => ({ nodeId: id, ...m, snippet: snippetFor(m) }));
        return text({ file: storePath(repoDir), figmaFile: store.file || null, count: rows.length, components: rows });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_set_repo_code_map",
    {
      description:
        "Save a component-to-code mapping in the repo (.figma/code-map.json) rather than inside the Figma file. Use this when the person has no edit access, or when the mapping should be reviewed in a pull request. figma_sync_code_map pushes them into Figma later.",
      inputSchema: {
        repoDir: repoArg,
        nodeId: z.string().min(1).describe("Figma component or component set id, e.g. '3444:5120'."),
        name: z.string().optional().describe("Figma component name, for readability."),
        ...mappingShape,
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async ({ repoDir, nodeId, name, ...mapping }) => {
      try {
        const r = setMapping(repoDir, { nodeId, name, mapping });
        return text({ saved: r.file, nodeId, mapping: r.mapping, snippet: snippetFor(r.mapping) });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_remove_repo_code_map",
    {
      description: "Remove a mapping from the repo store.",
      inputSchema: { repoDir: repoArg, nodeId: z.string().min(1) },
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async ({ repoDir, nodeId }) => {
      try {
        return text({ removed: removeMapping(repoDir, nodeId), file: storePath(repoDir) });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_sync_code_map",
    {
      description:
        "Move mappings between the repo store and the open Figma file. 'pull' copies what is in the file into the repo (read only, works on any seat that can run the plugin). 'push' writes the repo's mappings into the file so Dev Mode shows them, which needs 'Allow edits' and edit access.",
      inputSchema: {
        repoDir: repoArg,
        direction: z.enum(["pull", "push"]),
        pageId: z.string().optional().describe("Page id, or 'all'. Default all pages. Pull only."),
        dryRun: z.boolean().optional().describe("Report what would change without writing."),
      },
      annotations: { destructiveHint: false, readOnlyHint: false },
    },
    async ({ repoDir, direction, pageId = "all", dryRun = false }) => {
      try {
        if (direction === "pull") {
          const list = await bridge.request("components", { pageId, mappedOnly: true }, 120000);
          const results = [];
          for (const c of list.components || []) {
            if (!c.mapping) continue;
            results.push({ nodeId: c.id, name: c.name, componentName: c.mapping.componentName });
            if (!dryRun) setMapping(repoDir, { nodeId: c.id, name: c.name, mapping: c.mapping, fileName: list.fileName });
          }
          return text({ direction, dryRun, pulled: results.length, file: storePath(repoDir), components: results });
        }
        const store = readStore(repoDir);
        const results = [];
        for (const [nodeId, m] of Object.entries(store.components)) {
          if (dryRun) {
            results.push({ nodeId, componentName: m.componentName, wouldWrite: true });
            continue;
          }
          try {
            const r = await bridge.request("code_map_set", { nodeId, componentName: m.componentName, source: m.source, framework: m.framework, importPath: m.importPath, props: m.props, template: m.template }, 30000);
            results.push({ nodeId, ok: true, target: r.target && r.target.name });
          } catch (e) {
            results.push({ nodeId, ok: false, error: e.message });
          }
        }
        const ok = results.filter((r) => r.ok || r.wouldWrite).length;
        return text({ direction, dryRun, pushed: ok, failed: results.length - ok, results });
      } catch (e) {
        return fail(e);
      }
    }
  );

  // ---------------- REST reading ----------------

  const restFor = (repoDir) => {
    const { token, source, warning } = tokenFrom(process.env, repoDir);
    return { rest: new FigmaRest({ token, cacheDir: process.env.FIGMA_REST_CACHE, tokenWarning: warning }), tokenSource: source, tokenWarning: warning };
  };
  const fileArg = z.string().min(1).describe("Figma file key, or any figma.com file URL.");
  const refreshArg = z.boolean().optional().describe("Ignore the cache and spend a request. Default false.");

  server.registerTool(
    "figma_rest_status",
    {
      description:
        "Whether a Figma personal access token is available for REST reading, and how many REST calls this machine has spent this month. View and Collab seats get roughly 20 file or image requests per month, which is why every read is cached.",
      inputSchema: { repoDir: z.string().optional().describe("Also look for .figma/token in this folder (used only when git ignores it).") },
      annotations: { readOnlyHint: true },
    },
    async ({ repoDir }) => {
      const { rest, tokenSource, tokenWarning } = restFor(repoDir);
      const usage = rest.usage();
      return text({
        tokenFound: Boolean(rest.token),
        tokenSource,
        ...(tokenWarning ? { tokenWarning } : {}),
        cacheDir: rest.cacheDir,
        month: usage.month,
        callsThisMonth: usage.calls,
        byEndpoint: usage.byEndpoint,
        note: "Free, View and Collab seats: about 20 file or image requests a month. Dev and Full seats: 10 to 20 a minute.",
      });
    }
  );

  server.registerTool(
    "figma_rest_file",
    {
      description:
        "Read a Figma file through the REST API with the reader's own token, no plugin and no edit access needed. Cached on disk and reused until you ask for a refresh, because view seats have a monthly budget. Use depth to keep the response small.",
      inputSchema: {
        file: fileArg,
        depth: z.number().int().min(1).max(10).optional().describe("How deep to read. Default 2, which lists pages and top-level frames."),
        nodeId: z.string().optional().describe("Read one node instead of the whole file."),
        repoDir: z.string().optional(),
        refresh: refreshArg,
        savePath: z.string().optional().describe("Absolute path to write the JSON to, for use offline."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ file, depth = 2, nodeId, repoDir, refresh = false, savePath }) => {
      try {
        const { rest } = restFor(repoDir);
        const ref = parseFileRef(file);
        const id = nodeId || ref.nodeId;
        const endpoint = id ? `/files/${ref.key}/nodes?ids=${encodeURIComponent(id)}&depth=${depth}` : `/files/${ref.key}?depth=${depth}`;
        const r = await rest.get(endpoint, { refresh });
        if (savePath) {
          if (!path.isAbsolute(savePath)) throw new Error("savePath must be absolute.");
          fs.mkdirSync(path.dirname(savePath), { recursive: true });
          fs.writeFileSync(savePath, JSON.stringify(r.data, null, 1));
        }
        const doc = r.data.document || (r.data.nodes && Object.values(r.data.nodes)[0] && Object.values(r.data.nodes)[0].document);
        const summary = {
          fileKey: ref.key,
          name: r.data.name,
          lastModified: r.data.lastModified,
          version: r.data.version,
          fromCache: r.fromCache,
          fetchedAt: r.fetchedAt,
          callsThisMonth: r.calls,
          saved: savePath || null,
          root: doc ? { id: doc.id, name: doc.name, type: doc.type, children: (doc.children || []).map((c) => ({ id: c.id, name: c.name, type: c.type })) } : null,
        };
        return text(summary);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "figma_rest_images",
    {
      description: "Render nodes to image URLs through the REST API and optionally download them. Counts against the same monthly budget, so batch the ids into one call.",
      inputSchema: {
        file: fileArg,
        ids: z.array(z.string().min(1)).min(1).max(50),
        format: z.enum(["png", "jpg", "svg", "pdf"]).optional(),
        scale: z.number().min(0.01).max(4).optional(),
        saveDir: z.string().optional().describe("Absolute folder to download the images into."),
        repoDir: z.string().optional(),
        refresh: refreshArg,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ file, ids, format = "png", scale = 2, saveDir, repoDir, refresh = false }) => {
      try {
        const { rest } = restFor(repoDir);
        const ref = parseFileRef(file);
        const endpoint = `/images/${ref.key}?ids=${encodeURIComponent(ids.join(","))}&format=${format}&scale=${scale}`;
        const r = await rest.get(endpoint, { refresh });
        const saved = [];
        const failed = [];
        if (saveDir) {
          if (!path.isAbsolute(saveDir)) throw new Error("saveDir must be absolute.");
          fs.mkdirSync(saveDir, { recursive: true });
          for (const [id, url] of Object.entries(r.data.images || {})) {
            if (!url) continue;
            // Image URLs are signed and expire; a cached answer can hold dead ones. Never save an error page as an image.
            const res = await fetch(url);
            if (!res.ok) {
              failed.push({ id, status: res.status, hint: r.fromCache ? "The cached image link has probably expired; retry with refresh: true." : "Figma refused the download." });
              continue;
            }
            const bytes = Buffer.from(await res.arrayBuffer());
            const out = path.join(saveDir, id.replace(/[:;]/g, "_") + "." + format);
            fs.writeFileSync(out, bytes);
            saved.push({ id, file: out, bytes: bytes.length });
          }
        }
        return text({ fileKey: ref.key, format, scale, fromCache: r.fromCache, callsThisMonth: r.calls, images: r.data.images, saved, failed });
      } catch (e) {
        return fail(e);
      }
    }
  );
}
