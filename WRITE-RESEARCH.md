# Making the Webority Figma MCP Write into Figma (no rate limits)

Research date: 15-Sep-2026. Based on the webority-os source (v0.3.21), Figma plugin docs, and two open-source projects that already do this.

## Summary

**Yes, it is fully possible, and it has no Figma rate limits.** Writes run through the Figma **Plugin API** inside your desktop app, not Figma's cloud MCP, so the 200 calls/day cap does not apply. The Webority bridge already has everything needed for transport: the plugin only reads today because `code.ts` has no write commands. Two proven patterns exist: **typed write tools** (TalkToFigma, 30+ tools like `create_frame`, `set_fill_color`) and **one "run code" tool** (Southleft's figma-console-mcp `EXECUTE_CODE`, same idea as the official `use_figma`). **Recommended: a hybrid.** One `figma_execute` tool for unlimited power, plus 6 to 8 typed tools for common safe edits. **Fix the bridge security first**, because a write-capable port with no access check lets any local program edit your files.

---

## 1. Why the local route has "no limits"

| | Official Figma MCP (`use_figma`) | Local plugin bridge (Webority) |
|---|---|---|
| Runs through | Figma cloud | Figma desktop Plugin API on your PC |
| Rate limit | 200 reads/day on Pro Full seat (writes exempt, but reads to check work count) | **None from Figma** |
| Needs | A link | Desktop app + plugin panel open |
| Plan gating | Some features Org/Enterprise only | Any plan where you can edit the file |
| Can edit | Yes | Yes, once write commands are added |

**Real limits that still apply** (Figma itself, not rate limits):
- You need **edit access** to the file (your Full seat on Webority Pro is fine; View-seat teams are not).
- **Dev Mode is read-only.** Figma docs: *"Plugins in Dev Mode are read-only ... these plugins won't be able to edit the contents of the document."* The plugin must be run from the normal design editor.
- Plugin code runs on Figma's main thread: very large jobs (thousands of nodes) freeze the UI until done. Batch them.
- Text needs `figma.loadFontAsync(font)` before any edit, and the font must be available.
- Images: `figma.createImage(bytes)`, max 4096 × 4096 px.
- Team library components/variables need their **key** (`importComponentByKeyAsync`, `importVariableByKeyAsync`) and the `teamlibrary` permission to list them.
- The panel must stay open.

---

## 2. Prior art (proven, open source)

| Project | Approach | Notes |
|---|---|---|
| [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) (MIT) | ~40 **typed tools** over a WebSocket relay + plugin | `create_frame`, `create_text`, `set_fill_color`, `set_layout_mode`, `set_padding`, `set_layout_sizing`, `create_component_instance`, `set_instance_overrides`, `set_text_content`, `move/resize/clone/delete_node`, `set_annotation`, `create_connections` |
| [southleft/figma-console-mcp](https://github.com/southleft/figma-console-mcp) Desktop Bridge (MIT) | **Run arbitrary Plugin API code** (`EXECUTE_CODE`) plus typed helpers | Wraps code as `(async function(){ ... })()` and runs it with `eval` (their comment: *"AsyncFunction is restricted in Figma's plugin sandbox, but eval works"*), with a timeout |
| [santiagoisra/figbridge](https://github.com/santiagoisra/figbridge) | Packages Southleft's bridge | Its own warning: *"anything that can reach 127.0.0.1:8787 can drive it"* |
| Official Figma `use_figma` | Runs Plugin API JS in the file, cloud side | Same "execute code" model; ships a `figma-use` skill teaching the API |

Their plugin architecture is the same as Webority's: UI iframe holds the WebSocket, sandbox runs the Figma API.

---

## 3. Design options

### Option A: Typed write tools only
`figma_create_frame`, `figma_set_text`, `figma_set_fill`, `figma_set_auto_layout`, ...
- ✅ Validated inputs, predictable, easy to review, safe errors
- ❌ 30 to 40 tools to build and maintain, always missing the one property you need

### Option B: One `figma_execute` tool
Claude writes Plugin API JavaScript; the plugin runs it.
- ✅ Truly unlimited: anything the Plugin API can do (variables, components, prototypes, auto layout, styles)
- ✅ ~60 lines of new code total
- ❌ Riskiest: any code runs against the open file, mistakes can delete work (undo still works)
- ❌ Quality depends on Claude knowing the Plugin API (the official `figma-use` skill can be reused as guidance)

### Option C: Hybrid (recommended)
`figma_execute` for power, plus a small typed set for the everyday safe edits:

| Tool | Does |
|---|---|
| `figma_execute` | Run Plugin API code, returns JSON result |
| `figma_create_from_spec` | Build a frame tree from a JSON spec (frame, auto layout, text, fills, children) in one call |
| `figma_set_text` | Change text on one or many nodes (loads fonts automatically) |
| `figma_set_properties` | Set fills, strokes, radius, padding, gap, sizing (Fill/Hug/Fixed), name, visibility |
| `figma_create_instance` | Place a local or library component, set variant/props |
| `figma_bind_variable` | Bind a colour/number variable to a fill or property |
| `figma_move_node` / `figma_delete_node` | Reparent, reorder, delete |
| `figma_select_and_zoom` | Select the result and scroll it into view |

---

## 4. What would change in the Webority codebase

### 4.1 Plugin: `figma-plugin/src/code.ts`
New commands in `handle()`. Sketch of the two core ones:

```ts
case "execute":
  return executeCode(String(params.code), numberParam(params.timeoutMs, 30000));
case "set_text":
  return setText(params.edits as { nodeId: string; characters: string }[]);
```

```ts
async function executeCode(code: string, timeoutMs: number) {
  if (figma.editorType === "dev") throw new Error("Dev Mode is read-only. Run the plugin from the design editor.");
  const wrapped = "(async function() {\n" + code + "\n})()";
  const run = eval(wrapped) as Promise<unknown>;          // same technique as Southleft's bridge
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timed out after " + timeoutMs + "ms")), timeoutMs));
  const result = await Promise.race([run, timeout]);
  figma.commitUndo();                                      // one undo step per call
  return { result: toJsonSafe(result), fileName: figma.root.name };
}

async function setText(edits: { nodeId: string; characters: string }[]) {
  const done: string[] = [];
  for (const e of edits) {
    const node = await figma.getNodeByIdAsync(e.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Not a text node: " + e.nodeId);
    const fonts = node.getRangeAllFontNames(0, node.characters.length);
    await Promise.all(fonts.map((f) => figma.loadFontAsync(f)));
    node.characters = e.characters;
    done.push(node.id);
  }
  figma.commitUndo();
  return { updated: done };
}
```
`toJsonSafe` must turn node objects into `{id, name, type}`, because `postMessage` cannot carry live Figma nodes.

**Also in the plugin:**
- Run write commands **one at a time** (a simple promise queue), since `onmessage` is async today and two writes could interleave.
- Update the panel text in `ui.html`: "Reads only, no edits" becomes "Can edit this file" with a visible **Allow edits** toggle (off by default).

### 4.2 Manifest: `figma-plugin/manifest.json`
- Keep `editorType: ["figma", "dev"]`; writes simply refuse in Dev Mode.
- `"capabilities": ["inspect"]` can stay: Southleft's bridge keeps the same capability and still writes when run from the design editor.
- Add `"permissions": ["teamlibrary"]` to list library variables/components.

### 4.3 Server: `Webority.Cli/FigmaTools.cs`
```csharp
[McpServerTool(Name = "figma_execute", Destructive = true, ReadOnly = false)]
[Description("Run Figma Plugin API JavaScript in the open file (design editor only). Code runs inside an async function; `return` a JSON-safe value. Changes form one undo step.")]
public static async Task<string> FigmaExecute(FigmaBridge bridge, string code, int timeoutMs = 30000, CancellationToken ct = default)
{
    RequireRange(timeoutMs, 1000, 120000, nameof(timeoutMs));
    var result = await bridge.InvokeAsync("execute", new JsonObject { ["code"] = code, ["timeoutMs"] = timeoutMs }, timeoutMs + 5000, ct);
    return Serialize(result);
}
```
- Mark every write tool `Destructive = true` so Claude Code asks permission per call (unless you allow it).
- Update the server instructions in `McpHost.cs` (they say "strictly read-only").
- Add a `figma_status` field `canEdit` (design editor + edit access + edits allowed).

### 4.4 Bridge security: `Webority.Cli/FigmaBridge.cs` (must ship first)
Today any local program or possibly a web page can drive the bridge (`ANALYSIS.md` findings 1-2). With writes, that becomes "can edit or delete your designs".
1. **Origin check** on WebSocket upgrade: accept only `Origin: null` (Figma plugin iframe).
2. **Host check** on every request: only `localhost:3691`, `127.0.0.1:3691`, `[::1]:3691` (blocks DNS rebinding).
3. **Per-machine token**: `FigmaPluginInstaller` writes a random token into `index.html` (like the version stamp) and `~/.webority/figma-bridge.token`; require it in `hello` and on `/rpc`.
4. **One plugin at a time**: refuse or close the older socket, so writes never land in the wrong file.
5. **Allow-edits switch** in the plugin panel, off by default.

### 4.5 Tests
- Fake-plugin tests for `execute` and the typed tools (the existing `FigmaBridgeTests` pattern).
- Token / Origin / Host rejection tests.
- A small runtime test harness for `code.ts` (none exists today).

---

## 5. Safety model for "no limits"

| Risk | Guard |
|---|---|
| Claude deletes or overwrites work | One undo step per call (`figma.commitUndo`), `Destructive` flag prompts, Figma version history |
| Writes to the wrong file | `figma_status` shows file name; write tools return `fileName`; single plugin connection |
| Another program edits your file | Token + Origin + Host checks |
| Long job freezes Figma | Timeout per call, batch size guidance in the tool description |
| Accidental edits while reviewing | Allow-edits toggle off by default |
| Dev Mode confusion | Clear error: run from design editor |

---

## 6. Effort estimate

| Work | Size |
|---|---|
| Bridge security (token, Origin, Host, single plugin) | Medium |
| `figma_execute` (plugin + tool + queue + undo) | Small |
| 7 typed tools incl. `create_from_spec` | Medium |
| Plugin panel toggle + manifest | Small |
| Tests + docs + instructions | Medium |

A working local prototype of **`figma_execute` only** is about half a day. Full hybrid with security and tests is a few days.

---

## 7. How to proceed

webority-os is a shared team product, so changes go through its maintainers (no BUG/TASK filed, per your instruction). Two paths:

1. **Proposal to maintainers:** share this document.
2. **Local prototype:** a separate test plugin + tiny local server in `C:\Dev\Figma Run MCP\prototype` on a different port (e.g. 3692), not touching `weborityos`, to prove writes work on a scratch Figma file first.

## Sources
- Figma: [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode/), [Plugin manifest](https://developers.figma.com/docs/plugins/manifest/), [How plugins run](https://developers.figma.com/docs/plugins/how-plugins-run), [How we built the plugin system](https://www.figma.com/blog/how-we-built-the-figma-plugin-system/)
- [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp)
- [southleft/figma-console-mcp](https://github.com/southleft/figma-console-mcp) (`figma-desktop-bridge/code.js`, `EXECUTE_CODE`) and [docs](https://docs.figma-console-mcp.southleft.com/setup)
- [santiagoisra/figbridge](https://github.com/santiagoisra/figbridge)
- Webority source: `Webority/webority-os` development, `figma-plugin/src/code.ts`, `Webority.Cli/FigmaTools.cs`, `FigmaBridge.cs`, `McpHost.cs`
