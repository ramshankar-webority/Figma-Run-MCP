// Webority Figma Write (v1.3.0): plugin sandbox.
// Runs Figma Plugin API calls sent by the local MCP server (via ui.html, which owns the socket).
// Writes are refused unless the user ticks "Allow edits" in the panel. Commands run one at a time.

const CODE_NS = "webority";
const CODE_KEY = "codeMap";

// Dev Mode code panel: when this plugin is chosen as the code generator, show the mapped code
// component for the selected layer. No network needed: mappings live in the file itself.
if (figma.mode === "codegen") {
  figma.codegen.on("generate", async (event) => await generateCode(event.node, event.language));
} else {
  figma.showUI(__html__, { width: 340, height: 640, title: "Webority Figma MCP" });
}

let editsAllowed = false;
let queue = Promise.resolve();
let lingering = null; // a timed-out execute that is still running; the queue waits for it
const LINGER_MAX_MS = 5 * 60 * 1000;

function pushState() {
  figma.ui.postMessage({
    type: "state",
    state: {
      fileName: figma.root.name,
      editorType: figma.editorType,
      currentPage: figma.currentPage.name,
      editsAllowed,
    },
  });
}

if (figma.mode !== "codegen") figma.on("currentpagechange", pushState);

if (figma.mode !== "codegen") figma.ui.onmessage = (msg) => {
  if (!msg) return;
  if (msg.type === "allow-edits") {
    editsAllowed = !!msg.value;
    pushState();
    return;
  }
  if (msg.type === "request-state") {
    pushState();
    return;
  }
  const { id, command, params } = msg;
  if (id == null || !command) return;
  // Serialise: two writes must never interleave.
  queue = queue.then(async () => {
    if (lingering) {
      await lingering; // a timed-out execute is still writing
      lingering = null;
    }
    const changes = watchChanges();
    try {
      const result = await handle(command, params || {});
      await postActivity(id, command, params || {}, result, null, await changes.stop());
      figma.ui.postMessage({ id, result });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await postActivity(id, command, params || {}, null, error, await changes.stop());
      figma.ui.postMessage({ id, error });
    }
  });
};

// ---- Activity details for the panel log: a readable name, the layers touched, and where they are.

const ACTIVITY_NAMES = {
  status: "Checked connection", selection_brief: "Read selection", export: "Exported layer",
  execute: "Ran script", set_text: "Edited text", create_from_spec: "Created layers",
  components: "Listed components", code_map_get: "Read code mapping", code_map_set: "Saved code mapping",
  code_map_remove: "Removed code mapping", apply_effect: "Applied effect", list_children: "Listed children",
  apply_shader: "Applied shader", shader_usage: "Listed shader usage", render_frame: "Rendered frame",
  get_metadata: "Read file info", get_document: "Read page tree", get_node: "Read layer",
  find_nodes: "Searched layers", get_text: "Read text", get_styles: "Read styles",
  get_variable_defs: "Read variables", get_image: "Read image fill", place_image: "Placed generated image",
};

// Records layers created, changed or deleted on the current page while one command runs.
function watchChanges() {
  const seen = new Map();
  const page = figma.currentPage;
  const onChange = (event) => {
    for (const c of event.nodeChanges) {
      const prev = seen.get(c.id);
      // A layer created and then edited in the same call still counts as created.
      if (prev && prev.kind === "CREATE" && c.type === "PROPERTY_CHANGE") continue;
      seen.set(c.id, { kind: c.type, node: c.node, props: c.properties || [] });
    }
  };
  try { page.on("nodechange", onChange); } catch (e) { /* not available in this editor */ }
  return {
    // Change events are delivered after the edit, so give them a moment to arrive.
    async stop() {
      await new Promise((r) => setTimeout(r, 40));
      try { page.off("nodechange", onChange); } catch (e) { /* ignore */ }
      return Array.from(seen.entries()).map(([id, v]) => Object.assign({ id }, v));
    },
  };
}

function activityPath(node) {
  // "Page › Top frame › Parent" for a layer, skipping the layer itself.
  const parts = [];
  let p = node && node.parent;
  while (p && p.type !== "DOCUMENT") { parts.unshift(p.name); p = p.parent; }
  if (parts.length > 3) parts.splice(1, parts.length - 3, "…");
  return parts.join(" › ");
}

function layerLine(node) {
  if (!node || node.removed) return null;
  const size = "width" in node ? Math.round(node.width) + "×" + Math.round(node.height) : "";
  return { name: node.name, type: node.type, id: node.id, where: activityPath(node), size };
}

async function resolveLayers(ids) {
  const out = [];
  for (const id of ids.slice(0, 6)) {
    try { const l = layerLine(await figma.getNodeByIdAsync(String(id))); if (l) out.push(l); } catch (e) { /* skip */ }
  }
  return out;
}

async function postActivity(id, command, params, result, error, changes) {
  try {
    const act = { type: "activity", id, label: ACTIVITY_NAMES[command] || command, command, page: figma.currentPage.name, layers: [], changes: null, note: "" };
    // Layers the command was aimed at.
    const ids = []
      .concat(params.nodeId ? [params.nodeId] : [])
      .concat(Array.isArray(params.nodeIds) ? params.nodeIds : [])
      .concat(params.parentId ? [params.parentId] : [])
      .concat(Array.isArray(params.edits) ? params.edits.map((e) => e && e.nodeId).filter(Boolean) : []);
    if (params.frame) ids.push(params.frame);
    if (Array.isArray(params.frames)) ids.push(...params.frames);
    act.layers = await resolveLayers(ids);
    if (!act.layers.length && command === "selection_brief") act.layers = figma.currentPage.selection.slice(0, 6).map(layerLine).filter(Boolean);
    // What happened on the canvas.
    if (changes.length) {
      const created = changes.filter((c) => c.kind === "CREATE");
      const deleted = changes.filter((c) => c.kind === "DELETE");
      const edited = changes.filter((c) => c.kind === "PROPERTY_CHANGE");
      act.changes = { created: created.length, edited: edited.length, deleted: deleted.length };
      if (!act.layers.length) {
        act.layers = created.concat(edited).map((c) => layerLine(c.node)).filter(Boolean).slice(0, 6);
      }
      const props = new Set();
      edited.forEach((c) => c.props.forEach((p) => props.add(p)));
      if (props.size) act.note = "Changed: " + Array.from(props).slice(0, 6).join(", ");
    }
    // A short summary of what came back.
    if (!error && !act.note) {
      if (command === "find_nodes") act.note = "Query: " + [params.name, params.regex, (params.types || []).join("/")].filter(Boolean).join(" · ");
      else if (command === "export") act.note = String(params.format || "PNG").toUpperCase() + " @" + (Number(params.scale) || 1) + "x";
      else if (command === "apply_effect") act.note = "Preset: " + params.preset;
      else if (command === "code_map_set") act.note = [params.componentName, params.framework].filter(Boolean).join(" · ");
    }
    if (!error && Array.isArray(result)) act.note = (act.note ? act.note + " · " : "") + result.length + " result" + (result.length === 1 ? "" : "s");
    if (error) act.note = error;
    figma.ui.postMessage(act);
  } catch (e) { /* the log is cosmetic; never fail the command over it */ }
}

const WRITE_COMMANDS = new Set(["execute", "set_text", "create_from_spec", "code_map_set", "code_map_remove", "apply_effect", "apply_shader", "render_frame", "place_image"]);

async function handle(command, params) {
  if (WRITE_COMMANDS.has(command)) requireEdits();
  switch (command) {
    case "status":
      return {
        fileName: figma.root.name,
        editorType: figma.editorType,
        currentPage: { id: figma.currentPage.id, name: figma.currentPage.name },
        selectionCount: figma.currentPage.selection.length,
        editsAllowed,
      };
    case "selection_brief":
      return figma.currentPage.selection.map(brief);
    case "export":
      return await exportNode(String(params.nodeId), params.format, Number(params.scale) || 1);
    case "execute":
      return await execute(String(params.code), Number(params.timeoutMs) || 30000);
    case "set_text":
      return await setText(params.edits || []);
    case "create_from_spec":
      return await createFromSpec(params.spec, params.parentId, params.select !== false);
    case "components":
      return await listComponents(params.pageId || null, params.mappedOnly === true, params);
    case "code_map_get":
      return await codeMapGet(String(params.nodeId));
    case "code_map_set":
      return await codeMapSet(params);
    case "code_map_remove":
      return await codeMapRemove(String(params.nodeId));
    case "apply_effect":
      return await applyEffect(params.nodeIds || [], String(params.preset), params.options || {});
    case "list_children":
      return await listChildren(String(params.parentId));
    case "apply_shader":
      return await applyShader(params);
    case "place_image":
      return await placeImage(params);
    case "shader_usage":
      return await shaderUsage(params.pageId || null);
    case "render_frame":
      return await renderFrame(params);
    case "get_metadata":
      return await getMetadata();
    case "get_document":
      return await getDocument(params);
    case "get_node":
      return await getNode(params);
    case "find_nodes":
      return await findNodes(params);
    case "get_text":
      return await getText(params);
    case "get_styles":
      return await getStyles();
    case "get_variable_defs":
      return await getVariableDefs();
    case "get_image":
      return await getImage(params);
    default:
      throw new Error("Unknown command: " + command);
  }
}

async function exportNode(nodeId, format, scale) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found: " + nodeId);
  if (!("exportAsync" in node)) throw new Error("This node cannot be exported: " + nodeId);
  const kind = format === "JPG" ? "JPG" : format === "SVG" ? "SVG" : "PNG";
  // SVG keeps icons and illustrations as vectors, so a rebuilt page stays crisp at any zoom.
  const settings = kind === "SVG" ? { format: "SVG", svgOutlineText: false, svgIdAttribute: true } : { format: kind, constraint: { type: "SCALE", value: Math.max(0.05, Math.min(4, scale)) } };
  const bytes = await node.exportAsync(settings);
  const factor = kind === "SVG" ? 1 : scale;
  return { base64: figma.base64Encode(bytes), format: kind, node: brief(node), width: Math.round(node.width * factor), height: Math.round(node.height * factor) };
}

function requireEdits() {
  if (figma.editorType === "dev") throw new Error("Dev Mode is read-only. Switch to the design editor and run the plugin there.");
  if (!editsAllowed) throw new Error("Edits are off. Tick 'Allow edits' in the Webority Figma MCP panel, then retry.");
}

function brief(n) {
  const o = { id: n.id, name: n.name, type: n.type };
  if ("width" in n) {
    o.width = Math.round(n.width);
    o.height = Math.round(n.height);
  }
  if (n.parent) o.parent = { id: n.parent.id, name: n.parent.name, type: n.parent.type };
  return o;
}

// ---- execute ----

async function execute(code, timeoutMs) {
  const wrapped = "(async function() {\n" + code + "\n})()";
  let run;
  try {
    // Indirect-free direct eval, same technique as the Southleft Desktop Bridge: the AsyncFunction
    // constructor is restricted in Figma's sandbox, eval is not.
    run = eval(wrapped);
  } catch (e) {
    throw new Error("Syntax error: " + (e && e.message ? e.message : String(e)));
  }
  let timer;
  let timedOut = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("Execution timed out after " + timeoutMs + "ms. The script is still running; the next commands wait until it finishes (up to " + LINGER_MAX_MS / 60000 + " minutes). Changes stay; undo to revert."));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([run, timeout]);
    return { result: toJsonSafe(result, 0), fileName: figma.root.name };
  } finally {
    clearTimeout(timer);
    if (timedOut) {
      // A promise cannot be cancelled. Hold the command queue until the script settles so its
      // writes never interleave with the next command, then close its undo step.
      lingering = Promise.race([Promise.resolve(run).catch(() => {}), new Promise((r) => setTimeout(r, LINGER_MAX_MS))]).then(() => {
        figma.commitUndo();
      });
    } else figma.commitUndo();
  }
}

function isNode(v) {
  return v && typeof v === "object" && typeof v.id === "string" && typeof v.type === "string" && "removed" in v;
}

function toJsonSafe(v, depth) {
  if (v === undefined) return null;
  if (v === figma.mixed) return "MIXED";
  if (v === null || typeof v !== "object") return typeof v === "function" ? "[function]" : v;
  if (isNode(v)) return v.removed ? { id: v.id, removed: true } : { id: v.id, name: v.name, type: v.type };
  if (depth > 6) return "[depth limit]";
  if (v instanceof Uint8Array) return "[Uint8Array " + v.length + " bytes]";
  if (Array.isArray(v)) return v.slice(0, 1000).map((x) => toJsonSafe(x, depth + 1));
  const out = {};
  for (const k of Object.keys(v)) out[k] = toJsonSafe(v[k], depth + 1);
  return out;
}

// ---- set_text ----

async function setText(edits) {
  const updated = [];
  for (const e of edits) {
    const node = await figma.getNodeByIdAsync(e.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Not a text layer: " + e.nodeId + (updated.length ? " (earlier edits in this call were applied)" : ""));
    const fonts = node.characters.length > 0 ? node.getRangeAllFontNames(0, node.characters.length) : [node.fontName];
    await Promise.all(fonts.filter((f) => f !== figma.mixed).map((f) => figma.loadFontAsync(f)));
    node.characters = e.characters;
    updated.push({ id: node.id, name: node.name });
  }
  figma.commitUndo();
  return { updated, fileName: figma.root.name };
}

// ---- create_from_spec ----

function parseHex(hex) {
  if (typeof hex !== "string") return null;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) throw new Error("Bad colour '" + hex + "'. Use #RGB, #RRGGBB or #RRGGBBAA.");
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { color: { r: n(0), g: n(2), b: n(4) }, opacity: h.length === 8 ? n(6) : 1 };
}

function solid(hex) {
  if (hex === "none") return [];
  const c = parseHex(hex);
  return [{ type: "SOLID", color: c.color, opacity: c.opacity }];
}

async function createFromSpec(spec, parentId, select) {
  if (!spec || typeof spec !== "object") throw new Error("spec is required");
  let parent = figma.currentPage;
  if (parentId) {
    const p = await figma.getNodeByIdAsync(parentId);
    if (!p || !("appendChild" in p)) throw new Error("parentId is not a container: " + parentId);
    parent = p;
  }
  const counter = { nodes: 0 };
  const root = await build(spec, parent, counter);
  if (parent === figma.currentPage && spec.x === undefined && spec.y === undefined) {
    const center = figma.viewport.center;
    root.x = Math.round(center.x - root.width / 2);
    root.y = Math.round(center.y - root.height / 2);
  }
  if (select) {
    figma.currentPage.selection = [root];
    figma.viewport.scrollAndZoomIntoView([root]);
  }
  figma.commitUndo();
  return { created: brief(root), nodeCount: counter.nodes, fileName: figma.root.name };
}

async function build(spec, parent, counter) {
  let node;
  switch (spec.type) {
    case "FRAME":
      node = figma.createFrame();
      node.fills = []; // frames default to white; only paint what the spec asks for
      break;
    case "RECTANGLE":
      node = figma.createRectangle();
      break;
    case "ELLIPSE":
      node = figma.createEllipse();
      break;
    case "TEXT":
      node = figma.createText();
      break;
    default:
      throw new Error("Unsupported type: " + spec.type);
  }
  counter.nodes++;
  parent.appendChild(node);
  if (spec.name) node.name = spec.name;

  if (spec.type === "TEXT") {
    const t = spec.text || { characters: "" };
    const font = { family: t.fontFamily || "Inter", style: t.fontStyle || "Regular" };
    try {
      await figma.loadFontAsync(font);
    } catch (e) {
      throw new Error("Font not available: " + font.family + " " + font.style);
    }
    node.fontName = font;
    node.characters = t.characters;
    if (t.fontSize) node.fontSize = t.fontSize;
    if (t.lineHeight) node.lineHeight = { value: t.lineHeight, unit: "PIXELS" };
    if (t.letterSpacing !== undefined) node.letterSpacing = { value: t.letterSpacing, unit: "PIXELS" };
    if (t.align) node.textAlignHorizontal = t.align;
    if (t.color) node.fills = solid(t.color);
  }

  if (spec.fill !== undefined && spec.type !== "TEXT") node.fills = solid(spec.fill);
  if (spec.stroke) node.strokes = solid(spec.stroke);
  if (spec.strokeWeight !== undefined) node.strokeWeight = spec.strokeWeight;
  if (spec.cornerRadius !== undefined && "cornerRadius" in node) node.cornerRadius = spec.cornerRadius;
  if (spec.opacity !== undefined) node.opacity = spec.opacity;
  if (spec.clipsContent !== undefined && spec.type === "FRAME") node.clipsContent = spec.clipsContent;

  if (spec.layout && spec.type === "FRAME") {
    const l = spec.layout;
    node.layoutMode = l.mode;
    if (l.wrap && l.mode === "HORIZONTAL") node.layoutWrap = "WRAP";
    const p = typeof l.padding === "number" ? { top: l.padding, right: l.padding, bottom: l.padding, left: l.padding } : l.padding;
    if (p) {
      node.paddingTop = p.top;
      node.paddingRight = p.right;
      node.paddingBottom = p.bottom;
      node.paddingLeft = p.left;
    }
    if (l.gap !== undefined) node.itemSpacing = l.gap;
    if (l.primaryAlign) node.primaryAxisAlignItems = l.primaryAlign;
    if (l.counterAlign) node.counterAxisAlignItems = l.counterAlign;
  }

  if (spec.width !== undefined || spec.height !== undefined) {
    node.resize(spec.width !== undefined ? spec.width : node.width, spec.height !== undefined ? spec.height : node.height);
  }
  if (spec.x !== undefined) node.x = spec.x;
  if (spec.y !== undefined) node.y = spec.y;

  for (const child of spec.children || []) {
    if (spec.type !== "FRAME") throw new Error("Only FRAME can have children (got children on " + spec.type + ")");
    await build(child, node, counter);
  }

  // Sizing last: FILL needs the node already inside an auto-layout parent, HUG needs its children.
  if (spec.sizing) {
    const parentIsAuto = "layoutMode" in parent && parent.layoutMode !== "NONE";
    const apply = (axis, value) => {
      if (!value) return;
      if (value === "FILL" && !parentIsAuto) throw new Error((spec.name || spec.type) + ": FILL needs an auto-layout parent");
      if (value === "HUG" && !(spec.type === "TEXT" || (spec.type === "FRAME" && spec.layout))) {
        throw new Error((spec.name || spec.type) + ": HUG needs auto layout on this frame (or a text layer)");
      }
      if (axis === "h") node.layoutSizingHorizontal = value;
      else node.layoutSizingVertical = value;
    };
    apply("h", spec.sizing.horizontal);
    apply("v", spec.sizing.vertical);
  } else if (spec.type === "TEXT" && spec.width !== undefined) {
    node.textAutoResize = "HEIGHT";
  }
  return node;
}


// ---- Code map (Code Connect alternative) ----

async function mapTarget(node) {
  // Mappings belong to the component set (or a standalone component). Instances resolve to it.
  // documentAccess is dynamic-page, so an instance's main component must be fetched asynchronously.
  let n = node;
  if (n && n.type === "INSTANCE") n = (await n.getMainComponentAsync()) || null;
  if (n && n.type === "COMPONENT" && n.parent && n.parent.type === "COMPONENT_SET") n = n.parent;
  return n;
}
async function readMap(node) {
  const n = await mapTarget(node);
  if (!n) return null;
  return parseMap(n.getSharedPluginData(CODE_NS, CODE_KEY));
}
// A stored mapping may be hand-edited or truncated; treat unreadable JSON as "not mapped".
function parseMap(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function propDefs(n) {
  try {
    const defs = n.componentPropertyDefinitions || {};
    const out = {};
    for (const k of Object.keys(defs)) {
      const d = defs[k];
      out[k.split("#")[0]] = { type: d.type, default: d.defaultValue, options: d.variantOptions || undefined };
    }
    return out;
  } catch (e) {
    return {};
  }
}

async function listComponents(pageId, mappedOnly, params) {
  const p = params || {};
  let roots;
  if (p.nodeId) {
    // Scope to one frame or section, which is what "check this selection" means.
    const scope = await figma.getNodeByIdAsync(String(p.nodeId));
    if (!scope) throw new Error("Node not found: " + p.nodeId);
    roots = [scope];
  } else if (pageId === "all") {
    await figma.loadAllPagesAsync();
    roots = figma.root.children;
  } else if (pageId) {
    const page = await figma.getNodeByIdAsync(pageId);
    if (!page || page.type !== "PAGE") throw new Error("Not a page id: " + pageId);
    await page.loadAsync();
    roots = [page];
  } else roots = [figma.currentPage];

  const rows = [];
  const seen = new Set();
  const byId = new Map();
  const pageNameOf = (n) => {
    let cur = n;
    while (cur && cur.type !== "PAGE") cur = cur.parent;
    return cur ? cur.name : "";
  };
  const add = (n, viaInstances) => {
    if (seen.has(n.id)) {
      if (viaInstances) {
        const existing = byId.get(n.id);
        if (existing) existing.usedByInstances = (existing.usedByInstances || 0) + 1;
      }
      return;
    }
    const map = n.getSharedPluginData(CODE_NS, CODE_KEY);
    if (mappedOnly && !map) return;
    seen.add(n.id);
    const row = {
      id: n.id,
      name: n.name,
      type: n.type,
      page: pageNameOf(n),
      variants: n.type === "COMPONENT_SET" ? n.children.length : 1,
      remote: n.remote === true,
      usedByInstances: viaInstances ? 1 : undefined,
      props: propDefs(n),
      mapping: parseMap(map),
    };
    rows.push(row);
    byId.set(n.id, row);
  };

  for (const root of roots) {
    if (!("findAllWithCriteria" in root)) continue;
    for (const n of root.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] })) {
      if (n.type === "COMPONENT" && n.parent && n.parent.type === "COMPONENT_SET") continue; // variants roll up to their set
      add(n, false);
      if (rows.length >= 500) return { count: rows.length, truncated: true, components: rows, fileName: figma.root.name };
    }
    // A frame full of instances has no component definitions of its own; resolve each instance to
    // the component behind it (often on another page or in a library) so the caller still sees it.
    if (p.includeInstances !== false) {
      for (const inst of root.findAllWithCriteria({ types: ["INSTANCE"] })) {
        let target = null;
        try {
          target = await mapTarget(inst);
        } catch (e) {}
        if (target && (target.type === "COMPONENT" || target.type === "COMPONENT_SET")) add(target, true);
        if (rows.length >= 500) return { count: rows.length, truncated: true, components: rows, fileName: figma.root.name };
      }
    }
  }
  return { count: rows.length, truncated: false, components: rows, fileName: figma.root.name };
}

async function codeMapGet(nodeId) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found: " + nodeId);
  const target = await mapTarget(node);
  if (!target) return { node: brief(node), mapped: false, reason: "Not a component, component set or instance." };
  let devResources = [];
  try { devResources = (await target.getDevResourcesAsync()).map((r) => ({ name: r.name, url: r.url })); } catch (e) {}
  const mapping = await readMap(node);
  return { node: brief(node), target: brief(target), mapped: !!mapping, mapping, props: propDefs(target), devResources, preview: mapping ? buildSnippet(node, mapping) : null };
}

async function codeMapSet(p) {
  const node = await figma.getNodeByIdAsync(String(p.nodeId));
  if (!node) throw new Error("Node not found: " + p.nodeId);
  const target = await mapTarget(node);
  if (!target || (target.type !== "COMPONENT" && target.type !== "COMPONENT_SET")) throw new Error("Map a component, component set or an instance of one. Got " + node.type + ".");
  const mapping = {
    componentName: String(p.componentName),
    source: p.source ? String(p.source) : "",
    framework: p.framework ? String(p.framework) : "React",
    importPath: p.importPath ? String(p.importPath) : "",
    props: p.props || {},
    template: p.template ? String(p.template) : "",
    updatedAt: new Date().toISOString(),
  };
  try {
    target.setSharedPluginData(CODE_NS, CODE_KEY, JSON.stringify(mapping));
  } catch (e) {
    const raw = e && e.message ? e.message : String(e);
    if (/read-only|remote/i.test(raw)) {
      throw new Error(
        "'" + target.name + "' comes from a published library, so a mapping cannot be saved here. Open the library file that owns it and map it there; every file using it then sees the mapping."
      );
    }
    throw e;
  }
  let devResource = null;
  if (/^https?:\/\//.test(mapping.source)) {
    try {
      const existing = await target.getDevResourcesAsync();
      if (!existing.some((r) => r.url === mapping.source)) await target.addDevResourceAsync(mapping.source, mapping.componentName);
      devResource = "added";
    } catch (e) {
      devResource = "not added: " + (e && e.message ? e.message : String(e));
    }
  }
  figma.commitUndo();
  return { target: brief(target), mapping, devResource, preview: buildSnippet(target, mapping) };
}

async function codeMapRemove(nodeId) {
  const node = await figma.getNodeByIdAsync(nodeId);
  const target = node && (await mapTarget(node));
  if (!target) throw new Error("No component found for " + nodeId);
  try {
    target.setSharedPluginData(CODE_NS, CODE_KEY, "");
  } catch (e) {
    throw new Error("'" + target.name + "' comes from a published library, so its mapping lives in the library file, not here.");
  }
  figma.commitUndo();
  return { target: brief(target), removed: true };
}

function instanceProps(node, mapping) {
  // Figma property name -> code prop name via mapping.props (e.g. {"Size":"size","Label":"children"}); "-" skips a prop.
  const out = {};
  if (node.type !== "INSTANCE") return out;
  let props = {};
  try { props = node.componentProperties || {}; } catch (e) {}
  for (const key of Object.keys(props)) {
    const clean = key.split("#")[0];
    const codeName = (mapping.props && mapping.props[clean]) || clean.charAt(0).toLowerCase() + clean.slice(1).replace(/\s+(\w)/g, (m, c) => c.toUpperCase());
    if (codeName === "-") continue;
    out[codeName] = props[key].value;
  }
  return out;
}

function buildSnippet(node, mapping) {
  const values = instanceProps(node, mapping);
  if (mapping.template) {
    return mapping.template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (values[k] !== undefined ? String(values[k]) : m));
  }
  const attrs = Object.keys(values)
    .filter((k) => k !== "children")
    .map((k) => {
      const v = values[k];
      if (typeof v === "boolean") return v ? k : k + "={false}";
      return k + '="' + String(v).replace(/"/g, "&quot;") + '"';
    })
    .join(" ");
  const importLine = mapping.importPath ? "import { " + mapping.componentName + ' } from "' + mapping.importPath + '";\n\n' : "";
  const open = "<" + mapping.componentName + (attrs ? " " + attrs : "");
  const body = values.children !== undefined ? open + ">" + values.children + "</" + mapping.componentName + ">" : open + " />";
  return importLine + body;
}

async function generateCode(node, language) {
  const mapping = await readMap(node);
  if (!mapping) {
    return [{ title: "Webority code map", language: "PLAINTEXT", code: 'No code mapping for "' + node.name + '".\nAsk Claude to map this component to its code component (figma_add_code_connect_map).' }];
  }
  const lang = /swift/i.test(mapping.framework) ? "SWIFT" : /kotlin|compose/i.test(mapping.framework) ? "KOTLIN" : /vue|html|svelte|web/i.test(mapping.framework) ? "HTML" : "TYPESCRIPT";
  const results = [{ title: mapping.componentName + " · " + mapping.framework, language: lang, code: buildSnippet(node, mapping) }];
  if (mapping.source) results.push({ title: "Source", language: "PLAINTEXT", code: mapping.source });
  return results;
}

// ---- Effects (shader alternative) ----

// Effect colour from #RGB, #RRGGBB or #RRGGBBAA. An explicit opacity wins, then the hex alpha, then the preset default.
function rgbaHex(h, opacity, fallback) {
  const hex = String(h || "#000000");
  const c = parseHex(hex);
  const hasAlpha = hex.replace("#", "").trim().length === 8;
  return { ...c.color, a: opacity ?? (hasAlpha ? c.opacity : fallback) };
}

function effectFor(preset, o) {
  switch (preset) {
    case "glass":
      return [{ type: "GLASS", visible: true, lightIntensity: o.lightIntensity ?? 0.6, lightAngle: o.lightAngle ?? -45, refraction: o.refraction ?? 0.8, depth: o.depth ?? 20, dispersion: o.dispersion ?? 0.35, radius: o.radius ?? 4 }];
    case "noise":
      return [{ type: "NOISE", visible: true, noiseType: "MONOTONE", noiseSize: o.size ?? 1, density: o.density ?? 0.5, color: rgbaHex(o.color, o.opacity, 0.25), blendMode: "NORMAL" }];
    case "texture":
      return [{ type: "TEXTURE", visible: true, noiseSize: o.size ?? 2, radius: o.radius ?? 4, clipToShape: o.clip ?? true }];
    case "glow":
      return [{ type: "DROP_SHADOW", visible: true, color: rgbaHex(o.color || "#FA4028", o.opacity, 0.6), offset: { x: 0, y: 0 }, radius: o.radius ?? 60, spread: o.spread ?? 0, blendMode: "NORMAL" }];
    case "shadow":
      return [{ type: "DROP_SHADOW", visible: true, color: rgbaHex(o.color, o.opacity, 0.18), offset: { x: 0, y: o.y ?? 16 }, radius: o.radius ?? 40, spread: o.spread ?? -8, blendMode: "NORMAL" }];
    case "background-blur":
      return [{ type: "BACKGROUND_BLUR", visible: true, radius: o.radius ?? 24 }];
    case "layer-blur":
      return [{ type: "LAYER_BLUR", visible: true, radius: o.radius ?? 16 }];
    case "none":
      return [];
    default:
      throw new Error("Unknown preset: " + preset + ". Use glass, noise, texture, glow, shadow, background-blur, layer-blur or none.");
  }
}

async function applyEffect(nodeIds, preset, o) {
  const fx = effectFor(preset, o);
  const done = [];
  for (const id of nodeIds) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n || !("effects" in n)) throw new Error("Node can't take effects: " + id);
    try {
      n.effects = o.replace === false ? [...n.effects, ...fx] : fx;
    } catch (e) {
      throw new Error("Figma rejected the " + preset + " effect on " + id + ": " + (e && e.message ? e.message : String(e)));
    }
    done.push(brief(n));
  }
  figma.commitUndo();
  return { preset, applied: done };
}

// ---- Shaders (pixel image fill + native effects) ----

const SHADER_KEY = "shader";

// Stored as an array, one entry per shader on that layer. Older builds wrote a single object.
function readShaders(node) {
  const raw = node.getSharedPluginData(CODE_NS, SHADER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return [];
  }
}

async function applyShader(p) {
  const nodeIds = p.nodeIds || [];
  if (!nodeIds.length) throw new Error("nodeIds is required");
  const fx = [];
  for (const e of p.effects || []) fx.push(...effectFor(String(e.preset), e.options || {}));
  const fill = p.fill || {};
  const image = p.imageBase64 ? figma.createImage(figma.base64Decode(p.imageBase64)) : null;
  const done = [];
  for (const id of nodeIds) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n) throw new Error("Node not found: " + id + (done.length ? " (earlier nodes in this call were changed)" : ""));
    if (image) {
      if (!("fills" in n)) throw new Error("Node can't take fills: " + id);
      const paint = { type: "IMAGE", imageHash: image.hash, scaleMode: fill.scaleMode || "FILL", opacity: fill.opacity == null ? 1 : fill.opacity, blendMode: fill.blendMode || "NORMAL" };
      if (paint.scaleMode === "TILE") paint.scalingFactor = fill.scalingFactor || 1;
      const current = n.fills === figma.mixed ? [] : n.fills;
      n.fills = fill.mode === "add" ? current.concat([paint]) : [paint];
    }
    if (fx.length || (p.effects && p.effects.length === 0 && p.clearEffects)) {
      if (!("effects" in n)) throw new Error("Node can't take effects: " + id);
      try {
        n.effects = p.effectsMode === "add" ? n.effects.concat(fx) : fx;
      } catch (e) {
        throw new Error("Figma rejected the shader effects on " + id + ": " + (e && e.message ? e.message : String(e)));
      }
    }
    const entry = Object.assign({}, p.shader || {}, { appliedAt: new Date().toISOString() });
    // Replacing the fills wipes out any earlier pixel shader, so its record goes too; an added
    // fill (an overlay like film grain) sits on top and both records are kept.
    const previous = image && fill.mode !== "add" ? [] : readShaders(n);
    const kept = previous.filter((x) => x && x.id !== entry.id);
    n.setSharedPluginData(CODE_NS, SHADER_KEY, JSON.stringify(kept.concat([entry])));
    done.push(brief(n));
  }
  figma.commitUndo();
  return { shader: p.shader || null, applied: done, imageFill: !!image, effects: fx.length };
}

// ---- Generated images (figma_generate_image) ----

const IMAGE_GEN_KEY = "imageGen";

// dryRun checks the targets before the slow generation and reports the size to generate at.
async function placeImage(p) {
  const nodeIds = p.nodeIds || [];
  const targets = [];
  for (const id of nodeIds) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n) throw new Error("Node not found: " + id);
    if (!("fills" in n) || n.type === "TEXT") throw new Error("Layer can't take an image fill: " + id + " (" + n.type + ")");
    targets.push(n);
  }
  let parent = null;
  if (!targets.length && p.parentId) {
    parent = await figma.getNodeByIdAsync(p.parentId);
    if (!parent || !("appendChild" in parent) || parent.type === "INSTANCE") throw new Error("Can't place a layer inside: " + p.parentId);
  }
  if (p.dryRun) {
    const t = targets[0];
    return { ok: true, size: t && "width" in t && t.width > 0 && t.height > 0 ? { width: t.width, height: t.height } : null };
  }

  const image = figma.createImage(figma.base64Decode(p.imageBase64));
  const fill = p.fill || {};
  const paint = { type: "IMAGE", imageHash: image.hash, scaleMode: fill.scaleMode || "FILL", opacity: fill.opacity == null ? 1 : fill.opacity };
  const meta = JSON.stringify(p.meta || {});
  const done = [];
  if (!targets.length) {
    const size = await image.getSizeAsync();
    // Keep the rectangle at a sensible canvas size: at most 1024 on its long side, half the pixels of a large image.
    const k = Math.min(1, 1024 / Math.max(size.width, size.height));
    const r = figma.createRectangle();
    r.resize(Math.max(1, Math.round(size.width * k)), Math.max(1, Math.round(size.height * k)));
    r.name = p.name || ("AI image: " + String((p.meta && p.meta.prompt) || "").slice(0, 40));
    r.fills = [paint];
    if (parent) {
      parent.appendChild(r);
    } else {
      const sel = figma.currentPage.selection[0];
      if (sel && "absoluteBoundingBox" in sel && sel.absoluteBoundingBox) {
        const b = sel.absoluteBoundingBox;
        r.x = b.x + b.width + 40;
        r.y = b.y;
      } else {
        r.x = Math.round(figma.viewport.center.x - r.width / 2);
        r.y = Math.round(figma.viewport.center.y - r.height / 2);
      }
      figma.currentPage.appendChild(r);
    }
    targets.push(r);
    figma.currentPage.selection = [r];
    figma.viewport.scrollAndZoomIntoView([r]);
  } else {
    for (const n of targets) {
      const current = n.fills === figma.mixed ? [] : n.fills;
      n.fills = fill.mode === "add" ? current.concat([paint]) : [paint];
    }
  }
  for (const n of targets) {
    n.setSharedPluginData(CODE_NS, IMAGE_GEN_KEY, meta);
    done.push(brief(n));
  }
  figma.commitUndo();
  return { created: nodeIds.length === 0, placed: done, imageHash: image.hash };
}

async function pagesFor(pageId) {
  if (pageId === "all") {
    await figma.loadAllPagesAsync();
    return figma.root.children;
  }
  if (pageId) {
    const p = await figma.getNodeByIdAsync(pageId);
    if (!p || p.type !== "PAGE") throw new Error("Not a page id: " + pageId);
    await p.loadAsync();
    return [p];
  }
  return [figma.currentPage];
}

async function shaderUsage(pageId) {
  const pages = await pagesFor(pageId);
  const byShader = {};
  let count = 0;
  for (const page of pages) {
    const nodes = page.findAll((n) => !!n.getSharedPluginData(CODE_NS, SHADER_KEY));
    for (const n of nodes) {
      for (const meta of readShaders(n)) {
        const key = meta.id || "unknown";
        if (!byShader[key]) byShader[key] = { id: key, name: meta.name || key, versions: [], nodes: [] };
        if (meta.version != null && byShader[key].versions.indexOf(meta.version) < 0) byShader[key].versions.push(meta.version);
        byShader[key].nodes.push(Object.assign(brief(n), { page: page.name, version: meta.version, params: meta.params || {}, appliedAt: meta.appliedAt }));
      }
      if (++count >= 2000) return { truncated: true, shaders: Object.values(byShader) };
    }
  }
  return { truncated: false, pages: pages.length, shaders: Object.values(byShader) };
}

// ---- Video frames ----

async function listChildren(parentId) {
  const parent = await figma.getNodeByIdAsync(parentId);
  if (!parent || !("children" in parent)) throw new Error("Not a container: " + parentId);
  return { parent: brief(parent), children: parent.children.map(brief) };
}

// Clones the node off-canvas, runs the animation code on the clone for this frame, exports it, deletes the clone.
async function renderFrame(p) {
  const node = await figma.getNodeByIdAsync(String(p.nodeId));
  if (!node) throw new Error("Node not found: " + p.nodeId);
  if (!("clone" in node) || !("exportAsync" in node)) throw new Error("This node cannot be animated: " + p.nodeId);
  const frame = Number(p.frame) || 0;
  const frames = Math.max(1, Number(p.frames) || 1);
  const t = frames === 1 ? 0 : frame / (frames - 1);
  let fn;
  try {
    fn = eval("(async function(node, t, frame, frames, params) {\n" + String(p.code || "") + "\n})");
  } catch (e) {
    throw new Error("Animation code syntax error: " + (e && e.message ? e.message : String(e)));
  }
  const clone = node.clone();
  try {
    figma.currentPage.appendChild(clone);
    clone.x = -1000000;
    clone.y = -1000000;
    await fn(clone, t, frame, frames, p.params || {});
    const scale = Math.max(0.05, Math.min(4, Number(p.scale) || 1));
    const bytes = await clone.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
    return { base64: figma.base64Encode(bytes), frame, t };
  } finally {
    if (!clone.removed) clone.remove();
  }
}

// ---- Structured reads (metadata, document, node, find, text, styles, variables, images) ----
// Richer than the read-only weborityos plugin: sizing (Fill/Hug), min/max, constraints, component
// properties and variants, full text metrics, style links with names, bound variables with names,
// per-corner radius, blend mode, rotation, masks and prototype reactions.

const MIXED = "MIXED";
const styleNameCache = new Map();
const variableNameCache = new Map();

function hexOf(c, a) {
  const b = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return "#" + b(c.r) + b(c.g) + b(c.b) + (a === undefined || a >= 1 ? "" : b(a));
}

async function styleName(id) {
  if (!id || id === figma.mixed) return undefined;
  if (styleNameCache.has(id)) return styleNameCache.get(id);
  let name;
  try {
    const s = await figma.getStyleByIdAsync(id);
    name = s ? s.name : undefined;
  } catch (e) {
    name = undefined;
  }
  styleNameCache.set(id, name);
  return name;
}

async function variableName(id) {
  if (!id) return undefined;
  if (variableNameCache.has(id)) return variableNameCache.get(id);
  let name;
  try {
    const v = await figma.variables.getVariableByIdAsync(id);
    name = v ? v.name : undefined;
  } catch (e) {
    name = undefined;
  }
  variableNameCache.set(id, name);
  return name;
}

async function boundVars(node) {
  const bound = node.boundVariables;
  if (!bound) return undefined;
  const out = {};
  for (const key of Object.keys(bound)) {
    const value = bound[key];
    const one = async (alias) => (alias && alias.id ? (await variableName(alias.id)) || alias.id : undefined);
    if (Array.isArray(value)) {
      const names = [];
      for (const a of value) names.push(await one(a));
      if (names.some(Boolean)) out[key] = names;
    } else {
      const n = await one(value);
      if (n) out[key] = n;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

async function paintOf(p) {
  if (!p) return null;
  const o = { type: p.type };
  if (p.visible === false) o.visible = false;
  if (p.opacity !== undefined && p.opacity !== 1) o.opacity = round(p.opacity, 3);
  if (p.blendMode && p.blendMode !== "NORMAL") o.blendMode = p.blendMode;
  if (p.type === "SOLID") {
    o.color = hexOf(p.color, p.opacity);
    o.rgb = { r: round(p.color.r, 4), g: round(p.color.g, 4), b: round(p.color.b, 4) };
  } else if (p.type.indexOf("GRADIENT") === 0) {
    o.stops = (p.gradientStops || []).map((s) => ({ position: round(s.position, 3), color: hexOf(s.color, s.color.a) }));
  } else if (p.type === "IMAGE") {
    o.imageHash = p.imageHash;
    o.scaleMode = p.scaleMode;
  } else if (p.type === "VIDEO") {
    o.videoHash = p.videoHash;
  }
  if (p.boundVariables && p.boundVariables.color && p.boundVariables.color.id) o.variable = (await variableName(p.boundVariables.color.id)) || p.boundVariables.color.id;
  return o;
}

function round(n, digits) {
  if (typeof n !== "number" || !isFinite(n)) return n;
  const f = Math.pow(10, digits === undefined ? 2 : digits);
  return Math.round(n * f) / f;
}

function cornerRadii(n) {
  if (!("cornerRadius" in n)) return undefined;
  if (n.cornerRadius !== figma.mixed) return n.cornerRadius || undefined;
  return { topLeft: n.topLeftRadius, topRight: n.topRightRadius, bottomRight: n.bottomRightRadius, bottomLeft: n.bottomLeftRadius };
}

function textMetrics(n) {
  const t = {
    characters: n.characters,
    fontSize: n.fontSize === figma.mixed ? MIXED : n.fontSize,
    fontName: n.fontName === figma.mixed ? MIXED : n.fontName,
    textAlignHorizontal: n.textAlignHorizontal,
    textAlignVertical: n.textAlignVertical,
    textAutoResize: n.textAutoResize,
  };
  const val = (v) => (v === figma.mixed ? MIXED : v && typeof v === "object" ? (v.unit === "AUTO" ? "AUTO" : round(v.value, 2) + (v.unit === "PERCENT" ? "%" : "px")) : v);
  t.lineHeight = val(n.lineHeight);
  t.letterSpacing = val(n.letterSpacing);
  if (n.textCase !== undefined) t.textCase = n.textCase === figma.mixed ? MIXED : n.textCase;
  if (n.textDecoration !== undefined) t.textDecoration = n.textDecoration === figma.mixed ? MIXED : n.textDecoration;
  if (n.paragraphSpacing) t.paragraphSpacing = n.paragraphSpacing;
  if (n.textTruncation && n.textTruncation !== "DISABLED") t.truncation = n.textTruncation;
  // Mixed styling: report each run so nothing is silently dropped. Colour counts too: a heading with
  // one word in the brand colour has a single font but two fills.
  const mixedFill = "fills" in n && n.fills === figma.mixed;
  if (t.fontSize === MIXED || t.fontName === MIXED || mixedFill) {
    try {
      t.segments = n.getStyledTextSegments(["fontName", "fontSize", "fills", "lineHeight", "letterSpacing"]).slice(0, 50).map((s) => ({
        start: s.start,
        end: s.end,
        text: s.characters.slice(0, 120),
        fontName: s.fontName,
        fontSize: s.fontSize,
        color: s.fills && s.fills[0] && s.fills[0].type === "SOLID" ? hexOf(s.fills[0].color, s.fills[0].opacity) : undefined,
      }));
    } catch (e) {}
  }
  return t;
}

async function serialize(node, depth, opts) {
  const o = { id: node.id, name: node.name, type: node.type };
  if (node.visible === false) o.visible = false;
  if ("opacity" in node && node.opacity !== 1) o.opacity = round(node.opacity, 3);
  if ("locked" in node && node.locked) o.locked = true;
  if ("blendMode" in node && node.blendMode && node.blendMode !== "PASS_THROUGH" && node.blendMode !== "NORMAL") o.blendMode = node.blendMode;
  if ("isMask" in node && node.isMask) o.isMask = true;
  if ("rotation" in node && node.rotation) o.rotation = round(node.rotation, 2);
  if ("width" in node) {
    o.x = round(node.x);
    o.y = round(node.y);
    o.width = round(node.width);
    o.height = round(node.height);
    // x/y mean "relative to the parent frame", which is not the parent node inside a group, so the
    // absolute box is what a rebuild needs to place every layer correctly.
    if (node.absoluteBoundingBox) o.abs = { x: round(node.absoluteBoundingBox.x), y: round(node.absoluteBoundingBox.y), width: round(node.absoluteBoundingBox.width), height: round(node.absoluteBoundingBox.height) };
    if (node.absoluteRenderBounds) o.renderBox = { x: round(node.absoluteRenderBounds.x), y: round(node.absoluteRenderBounds.y), width: round(node.absoluteRenderBounds.width), height: round(node.absoluteRenderBounds.height) };
  }

  if ("layoutMode" in node && node.layoutMode && node.layoutMode !== "NONE") {
    o.layout = {
      mode: node.layoutMode,
      padding: { top: node.paddingTop, right: node.paddingRight, bottom: node.paddingBottom, left: node.paddingLeft },
      gap: node.itemSpacing,
      primaryAlign: node.primaryAxisAlignItems,
      counterAlign: node.counterAxisAlignItems,
    };
    if (node.layoutWrap === "WRAP") o.layout.wrap = true;
    if (node.counterAxisSpacing) o.layout.rowGap = node.counterAxisSpacing;
  }
  // The weborityos reader drops these three, which is why designs came back unbuildable.
  if ("layoutSizingHorizontal" in node) o.sizing = { horizontal: node.layoutSizingHorizontal, vertical: node.layoutSizingVertical };
  if ("minWidth" in node && (node.minWidth != null || node.maxWidth != null || node.minHeight != null || node.maxHeight != null)) {
    o.limits = { minWidth: node.minWidth, maxWidth: node.maxWidth, minHeight: node.minHeight, maxHeight: node.maxHeight };
  }
  if ("constraints" in node && node.constraints) o.constraints = node.constraints;
  if ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE") o.absolutePosition = true;
  if ("clipsContent" in node) o.clipsContent = node.clipsContent;

  if ("fills" in node && node.fills !== figma.mixed && node.fills.length) {
    o.fills = [];
    for (const p of node.fills) o.fills.push(await paintOf(p));
  } else if ("fills" in node && node.fills === figma.mixed) o.fills = MIXED;
  if ("strokes" in node && node.strokes.length) {
    o.strokes = [];
    for (const p of node.strokes) o.strokes.push(await paintOf(p));
    o.strokeWeight = node.strokeWeight === figma.mixed ? MIXED : node.strokeWeight;
    // A frame can carry a different weight per side, which is how divider grids are drawn. Without
    // these, a cell with one divider looks like a full box.
    if ("strokeTopWeight" in node) {
      const sides = { top: node.strokeTopWeight, right: node.strokeRightWeight, bottom: node.strokeBottomWeight, left: node.strokeLeftWeight };
      if (o.strokeWeight === MIXED || sides.top !== sides.right || sides.right !== sides.bottom || sides.bottom !== sides.left) o.strokeWeights = sides;
    }
    o.strokeAlign = node.strokeAlign;
    if (node.dashPattern && node.dashPattern.length) o.dashPattern = node.dashPattern;
  }
  const radius = cornerRadii(node);
  if (radius !== undefined) o.cornerRadius = radius;
  if ("effects" in node && node.effects.length) {
    o.effects = node.effects.map((e) => {
      const x = { type: e.type, visible: e.visible !== false };
      if (e.radius !== undefined) x.radius = e.radius;
      if (e.color) x.color = hexOf(e.color, e.color.a);
      if (e.offset) x.offset = e.offset;
      if (e.spread) x.spread = e.spread;
      return x;
    });
  }

  if (node.type === "TEXT") o.text = textMetrics(node);

  // Style links, with names so the result is readable without a second lookup.
  const styles = {};
  for (const [key, prop] of [["fill", "fillStyleId"], ["stroke", "strokeStyleId"], ["text", "textStyleId"], ["effect", "effectStyleId"], ["grid", "gridStyleId"]]) {
    if (prop in node && node[prop] && node[prop] !== figma.mixed) {
      const name = await styleName(node[prop]);
      styles[key] = name || node[prop];
    }
  }
  if (Object.keys(styles).length) o.styles = styles;
  const vars = await boundVars(node);
  if (vars) o.variables = vars;

  if (node.type === "COMPONENT_SET" || node.type === "COMPONENT") {
    const defs = propDefs(node);
    if (Object.keys(defs).length) o.componentProperties = defs;
    if (node.key) o.key = node.key;
  }
  if (node.type === "INSTANCE") {
    try {
      const main = await node.getMainComponentAsync();
      if (main) o.mainComponent = { id: main.id, name: main.name, key: main.key, set: main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.name : undefined, setId: main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.id : undefined };
    } catch (e) {}
    try {
      const props = node.componentProperties || {};
      const values = {};
      for (const k of Object.keys(props)) values[k.split("#")[0]] = props[k].value;
      if (Object.keys(values).length) o.instanceProperties = values;
    } catch (e) {}
    try {
      if (node.variantProperties) o.variantProperties = node.variantProperties;
    } catch (e) {} // throws for an instance whose component set has errors
  }
  if ("reactions" in node && node.reactions && node.reactions.length) {
    o.prototype = node.reactions.slice(0, 10).map((r) => ({
      trigger: r.trigger && r.trigger.type,
      action: r.actions && r.actions[0] ? r.actions[0].type : undefined,
      destination: r.actions && r.actions[0] ? r.actions[0].destinationId : undefined,
    }));
  }

  if ("children" in node) {
    o.childCount = node.children.length;
    if (depth > 0) {
      o.children = [];
      for (const child of node.children) {
        if (opts && opts.includeHidden === false && child.visible === false) continue;
        if (opts && opts.counter && opts.counter.n >= opts.limit) {
          o.truncated = true;
          break;
        }
        if (opts && opts.counter) opts.counter.n++;
        o.children.push(await serialize(child, depth - 1, opts));
      }
    }
  }
  return o;
}

async function pageOf(id) {
  if (!id) return figma.currentPage;
  const p = await figma.getNodeByIdAsync(id);
  if (!p || p.type !== "PAGE") throw new Error("Not a page id: " + id);
  await p.loadAsync();
  return p;
}

async function getMetadata() {
  await figma.loadAllPagesAsync();
  return {
    file: figma.root.name,
    editorType: figma.editorType,
    currentPage: { id: figma.currentPage.id, name: figma.currentPage.name },
    pages: figma.root.children.map((p) => ({
      id: p.id,
      name: p.name,
      childCount: p.children.length,
      topLevel: p.children.slice(0, 60).map((c) => ({ id: c.id, name: c.name, type: c.type, width: "width" in c ? Math.round(c.width) : undefined, height: "height" in c ? Math.round(c.height) : undefined })),
    })),
  };
}

async function getDocument(p) {
  const page = await pageOf(p.pageId);
  const counter = { n: 0 };
  const limit = Math.max(1, Math.min(5000, Number(p.maxNodes) || 1500));
  const depth = Math.max(0, Math.min(20, p.depth === undefined ? 3 : Number(p.depth)));
  const node = await serialize(page, depth, { counter, limit, includeHidden: p.includeHidden !== false });
  return { page: { id: page.id, name: page.name }, nodes: counter.n, truncatedAt: counter.n >= limit ? limit : null, document: node };
}

async function getNode(p) {
  const node = await figma.getNodeByIdAsync(String(p.nodeId));
  if (!node) throw new Error("Node not found: " + p.nodeId);
  const counter = { n: 0 };
  const limit = Math.max(1, Math.min(5000, Number(p.maxNodes) || 1500));
  const depth = Math.max(0, Math.min(20, p.depth === undefined ? 4 : Number(p.depth)));
  const out = await serialize(node, depth, { counter, limit, includeHidden: p.includeHidden !== false });
  if (node.parent) out.parent = { id: node.parent.id, name: node.parent.name, type: node.parent.type };
  return { nodes: counter.n + 1, node: out };
}

async function findNodes(p) {
  const pages = p.pageId === "all" ? (await figma.loadAllPagesAsync(), figma.root.children) : [await pageOf(p.pageId)];
  const limit = Math.max(1, Math.min(1000, Number(p.limit) || 200));
  const types = Array.isArray(p.types) && p.types.length ? p.types : null;
  let re = null;
  if (p.name) {
    if (p.regex) re = new RegExp(p.name, "i");
    else {
      const needle = String(p.name).toLowerCase();
      re = { test: (s) => String(s).toLowerCase().indexOf(needle) >= 0 };
    }
  }
  const rows = [];
  let truncated = false;
  for (const page of pages) {
    const found = types ? page.findAllWithCriteria({ types }) : page.findAll(() => true);
    for (const n of found) {
      if (re && !re.test(n.name)) continue;
      if (p.text && !(n.type === "TEXT" && String(n.characters).toLowerCase().indexOf(String(p.text).toLowerCase()) >= 0)) continue;
      rows.push({
        id: n.id,
        name: n.name,
        type: n.type,
        page: page.name,
        width: "width" in n ? Math.round(n.width) : undefined,
        height: "height" in n ? Math.round(n.height) : undefined,
        path: nodePath(n),
        characters: n.type === "TEXT" ? n.characters.slice(0, 120) : undefined,
      });
      if (rows.length >= limit) {
        truncated = true;
        break;
      }
    }
    if (truncated) break;
  }
  return { count: rows.length, truncated, nodes: rows };
}

function nodePath(n) {
  const parts = [];
  let cur = n.parent;
  while (cur && cur.type !== "DOCUMENT") {
    parts.unshift(cur.name);
    cur = cur.parent;
  }
  return parts.join(" / ");
}

async function getText(p) {
  let scope;
  if (p.nodeId) {
    const n = await figma.getNodeByIdAsync(String(p.nodeId));
    if (!n) throw new Error("Node not found: " + p.nodeId);
    scope = [n];
  } else {
    scope = p.pageId === "all" ? (await figma.loadAllPagesAsync(), figma.root.children) : [await pageOf(p.pageId)];
  }
  const limit = Math.max(1, Math.min(2000, Number(p.limit) || 500));
  const rows = [];
  for (const root of scope) {
    const nodes = root.type === "TEXT" ? [root] : "findAllWithCriteria" in root ? root.findAllWithCriteria({ types: ["TEXT"] }) : [];
    for (const n of nodes) {
      const row = { id: n.id, name: n.name, characters: n.characters, path: nodePath(n) };
      if (p.withStyle !== false) {
        const t = textMetrics(n);
        row.fontSize = t.fontSize;
        row.fontName = t.fontName;
        row.lineHeight = t.lineHeight;
        row.letterSpacing = t.letterSpacing;
        row.align = t.textAlignHorizontal;
        const sid = n.textStyleId;
        if (sid && sid !== figma.mixed) row.textStyle = (await styleName(sid)) || sid;
        if (n.fills !== figma.mixed && n.fills[0] && n.fills[0].type === "SOLID") row.color = hexOf(n.fills[0].color, n.fills[0].opacity);
      }
      rows.push(row);
      if (rows.length >= limit) return { count: rows.length, truncated: true, texts: rows };
    }
  }
  return { count: rows.length, truncated: false, texts: rows };
}

async function getStyles() {
  const out = { paint: [], text: [], effect: [], grid: [] };
  const paints = await figma.getLocalPaintStylesAsync();
  for (const s of paints) {
    const row = { id: s.id, name: s.name, description: s.description || undefined, paints: [] };
    for (const p of s.paints) row.paints.push(await paintOf(p));
    out.paint.push(row);
  }
  for (const s of await figma.getLocalTextStylesAsync()) {
    const val = (v) => (v && typeof v === "object" ? (v.unit === "AUTO" ? "AUTO" : round(v.value, 2) + (v.unit === "PERCENT" ? "%" : "px")) : v);
    out.text.push({ id: s.id, name: s.name, description: s.description || undefined, fontName: s.fontName, fontSize: s.fontSize, lineHeight: val(s.lineHeight), letterSpacing: val(s.letterSpacing), textCase: s.textCase, textDecoration: s.textDecoration, paragraphSpacing: s.paragraphSpacing || undefined });
  }
  for (const s of await figma.getLocalEffectStylesAsync()) {
    out.effect.push({ id: s.id, name: s.name, effects: s.effects.map((e) => ({ type: e.type, radius: e.radius, color: e.color ? hexOf(e.color, e.color.a) : undefined, offset: e.offset, spread: e.spread })) });
  }
  for (const s of await figma.getLocalGridStylesAsync()) {
    out.grid.push({ id: s.id, name: s.name, grids: s.layoutGrids.map((g) => ({ pattern: g.pattern, count: g.count, gutterSize: g.gutterSize, sectionSize: g.sectionSize, alignment: g.alignment })) });
  }
  return { counts: { paint: out.paint.length, text: out.text.length, effect: out.effect.length, grid: out.grid.length }, styles: out };
}

async function getVariableDefs() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const out = [];
  for (const c of collections) {
    const modes = c.modes.map((m) => ({ id: m.modeId, name: m.name }));
    const variables = [];
    for (const id of c.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id);
      if (!v) continue;
      const values = {};
      for (const m of modes) {
        const raw = v.valuesByMode[m.id];
        if (raw && raw.type === "VARIABLE_ALIAS") values[m.name] = "-> " + ((await variableName(raw.id)) || raw.id);
        else if (raw && typeof raw === "object" && "r" in raw) values[m.name] = hexOf(raw, raw.a);
        else values[m.name] = raw;
      }
      variables.push({ id: v.id, name: v.name, type: v.resolvedType, scopes: v.scopes, description: v.description || undefined, values });
    }
    out.push({ id: c.id, name: c.name, defaultMode: (modes[0] || {}).name, modes, variableCount: variables.length, variables });
  }
  return { collections: out.length, variableCollections: out };
}

async function getImage(p) {
  let hash = p.imageHash;
  if (!hash) {
    const node = await figma.getNodeByIdAsync(String(p.nodeId));
    if (!node) throw new Error("Node not found: " + p.nodeId);
    if (!("fills" in node) || node.fills === figma.mixed) throw new Error("That node has no image fill: " + p.nodeId);
    const fill = node.fills.filter((f) => f.type === "IMAGE")[Number(p.fillIndex) || 0];
    if (!fill) throw new Error("No image fill on " + p.nodeId + ". Use figma_export to render it instead.");
    hash = fill.imageHash;
  }
  const image = figma.getImageByHash(hash);
  if (!image) throw new Error("No image for hash " + hash);
  const bytes = await image.getBytesAsync();
  const size = await image.getSizeAsync();
  return { imageHash: hash, width: size.width, height: size.height, base64: figma.base64Encode(bytes) };
}
