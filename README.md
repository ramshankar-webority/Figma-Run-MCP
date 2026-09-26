# Webority Figma MCP: Reverse Engineering Notes

> **Current product:** these notes cover the read-only weborityos Figma MCP (port 3691), kept for reference.
> The active tool is `webority-figma-write/`, registered in Claude Code as **`Figma-MCP-Webority`**: 49 tools that
> read and write the open file, generate images into it, map components to code, and answer design questions with no Figma seat at all.
> See `webority-figma-write/README.md` and `CLAUDE.md`.

Captured 15-Sep-2026 from weborityos CLI **v0.3.21** on this machine.

## Folder contents

| Path | What it is |
|---|---|
| `webority-figma-write/plugin/manifest.json` | The only Figma plugin manifest here: the active Webority Figma MCP plugin (v1.3.0, port 3692; id `webority-figma-write`) |
| `README.md` | These notes |
| `ANALYSIS.md` | Full codebase analysis of the server and plugin source |
| `FLOW.md` | End-to-end flow, process and setup |
| `WRITE-RESEARCH.md` | How to add write-into-Figma to the local MCP |
| `source/` | weborityos CLI source copied from Webority/webority-os (C# only; the `figma-plugin/` TS copy was deleted on 21-Sep-2026) |

Not copied: `weborityos.exe` (41 MB compiled .NET binary) and `config.json` (holds login credentials).

## Summary

Three parts: a small Figma plugin, a local WebSocket bridge on `127.0.0.1:3691`, and the MCP server built into `weborityos.exe`. The plugin is readable JavaScript, so the full protocol is visible. It is **read-only by design** and omits several design details (Fill/Hug sizing, component variants, prototype links).

## Architecture

```
Claude Code --MCP--> weborityos.exe (MCP server + WebSocket bridge on 127.0.0.1:3691)
                          |  JSON {id, command, params}
                          v
              Plugin UI iframe (index.html)   <- owns the WebSocket (sandbox has no network)
                          |  postMessage
                          v
              Plugin sandbox (code.js)        <- calls Figma Plugin API, returns {id, result|error}
```

- **Handshake:** plugin sends `{hello: true, version: "0.3.21"}` on connect; server uses it to detect stale plugin copies.
- **Reconnect:** plugin retries every 2 seconds if the bridge drops.
- **Leader:** several Claude sessions share one bridge; one weborityos process owns port 3691.
- **Manifest:** network limited to `ws://localhost:3691`; `editorType` figma + dev; `documentAccess: dynamic-page`; empty permissions.

## Setup

1. Open the **Figma desktop app** and any design file.
2. **Plugins > Development > Import plugin from manifest...**
3. Pick `C:\Users\WB0061-RAM-SHANKAR\.webority\figma-plugin\manifest.json` (use the original, the CLI keeps it updated).
4. Run **Webority Figma MCP (weborityos CLI)** and keep it open.

## Tool map

| MCP tool | Plugin command | Figma API | Limit |
|---|---|---|---|
| `figma_get_metadata` | `get_metadata` | `loadAllPagesAsync`, `root.children` | |
| `figma_get_document` | `get_document` | serialize page tree | depth 1 via MCP (plugin default 3) |
| `figma_get_node` | `get_node` | `getNodeByIdAsync` | depth 2 |
| `figma_get_selection` | `get_selection` | `currentPage.selection` | current page only |
| `figma_find_nodes` | `find_nodes` | `findAll` by name/type | 300 rows |
| `figma_get_text` | `get_text` | `findAll(TEXT)` | 500 rows |
| `figma_get_styles` | `get_styles` | local paint/text/effect/grid styles | local only |
| `figma_get_variable_defs` | `get_variable_defs` | local variable collections | local only |
| `figma_get_screenshot` / `figma_save_screenshot` | `export` | `exportAsync` PNG/JPG/SVG | scale 2 |
| `figma_save_image` | `get_image` | `getImageByHash().getBytesAsync` | |
| `figma_status` | (server only) | | |

`hex` colour values are added by the server; the plugin sends raw 0 to 1 RGB floats.

## Data returned per layer (`serializeNode`)

**Included:** id, name, type, visible, opacity, bounding box / size, auto layout (mode, padding, itemSpacing, alignment), fills, strokes + strokeWeight, cornerRadius, effects. Text: characters, fontSize, fontName, textAlignHorizontal.

**Not returned:**
- Sizing: Fill / Hug / Fixed, min/max, constraints, wrap, absolute positioning in auto layout
- Components: variants, component properties, main component of an instance, overrides
- Text detail: line height, letter spacing, text case, vertical alignment; mixed fonts/sizes are dropped
- Style links (`fillStyleId`, `textStyleId`) and layer-level variable links (padding, radius, spacing). Fill/stroke colour variables DO come through as variable IDs inside each paint (verified 15-Sep-2026), but not their names
- Mixed per-corner radius
- Prototype links, interactions, comments, blend mode, clipping, rotation, masks
- Team library styles and variables

## Observations

- **[warning]** No visible authentication on the bridge: the plugin sends only a version hello. Any local process could likely connect to port 3691 and impersonate the plugin (return fake data). It cannot read Figma files without the real plugin. Confirmed from server source, see ANALYSIS.md findings 1-2.
- **[info]** Plugin UI uses `postMessage(..., "*")`: standard in Figma plugin iframes, low risk.
- **[info]** Leftover update binary `~/.webority/bin/weborityos.exe.old-1787811999000` (41 MB).
- **[info]** `~/.webority/.mcp-update-notice.json` accumulates old notice IDs (24 entries) with no cleanup.

## Comparison with the official Figma MCP

| | Webority bridge | Official Figma MCP |
|---|---|---|
| Needs | Figma desktop + plugin open | A figma.com link |
| Reads your selection | Yes | No |
| Edits / creates designs | No (the write MCP does) | Yes |
| Rate limits | None | 200/day on Pro Full seat |
| Code Connect | No (the write MCP stores mappings in the file or the repo) | Blocked on Pro (tested 15-Sep-2026) |

## Not examined

- `weborityos.exe` binary itself (its source was reviewed instead, see ANALYSIS.md)
- `config.json` (credentials)
- Live bridge traffic (connecting to 3691 could disrupt other sessions)

## Suggested improvements (for webority-os maintainers)

Extend `serializeNode` in `code.ts` with: `layoutSizingHorizontal/Vertical`, `minWidth/maxWidth`, `constraints`, `componentProperties` / `variantProperties`, `mainComponent` id, `boundVariables`, `fillStyleId` / `textStyleId`, text `lineHeight` / `letterSpacing` / `textCase`, and per-corner radii.
