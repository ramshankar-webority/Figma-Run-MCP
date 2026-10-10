# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this folder is

Research and tooling around driving Figma desktop from Claude through a local plugin bridge (no Figma cloud MCP, so no rate limits). Not a git repo.

| Path | Status | What |
|---|---|---|
| `webority-figma-write/` | **Active product** | Node MCP server + Figma plugin (v1.7.0). 61 tools and 10 prompts: read, write, Figma Draw, prototyping and Motion (native MP4/GIF/WEBM export, custom animation styles), variables (colour + opacity, easing, timing), inspect CSS, default colour tokens, a Creative tab (isolated ChatGPT/Gemini browser + inbox for social media creatives), Code Connect, shaders, generative plugins, video, image generation, Mobbin reference boards, offline access for people with no Figma seat, Laya decisions, and the design review harness with 8 expert personas. Ports 3692-3699: each session binds the first free one; each Figma file's panel pairs with a free session, or joins a busy one when none is free, so one session can drive several files (`figma_use_file` picks the target; Switch button re-pairs). Registered in `~/.claude.json` as **`Figma-MCP-Webority`**. The plugin shows in Figma as **Webority Figma MCP** (id `webority-figma-write`) |
| `webority-figma-write/icons/iconsax/` | Asset library | All 993 Iconsax icons, 6 styles, 5,958 SVGs, plus `index.json` |
| `build/partners/` | Output | The Webority Partners page rebuilt from Figma: `index.html` (pixel exact, 0.927 SSIM), `responsive.html` (responsive and interactive), `assets/`, `design.json`, `verify/`. Has its own README |
| `build/viewer-project/` | Output | A project folder with `.figma/design-snapshot.json` and `.figma/code-map.json`, used to test the no-seat path |
| `source/` | Reference copy | The read-only weborityos CLI (C# `FigmaBridge.cs`, port 3691) copied from `Webority/webority-os`. Edit upstream, not here. The TS plugin copies (`plugin/`, `source/figma-plugin/`) were deleted on 21-Sep-2026 as stale v0.3.21 duplicates; pull them from upstream if ever needed |
| `research/` | Notes + screenshots | Capnix site research, social carousel spec |

Top-level docs: `README.md` (weborityos plugin notes, tool map, what `serializeNode` omits), `ANALYSIS.md` (C# bridge code review), `FLOW.md` (weborityos end-to-end flow), `WRITE-RESEARCH.md` (why/how the write MCP was designed). The MCP's own README lists every tool.

## Commands (run in `webority-figma-write/`)

```bash
npm install
npm test                                    # 30 checks: bridge security, libraries, MCP over stdio, image generation, the no-seat path, the Draw/Prototype/Motion tools, the Figma 2026 tools
npm start                                   # node server.js (normally Claude Code spawns it)

node tools/live-check-1.1.mjs <outDir>      # 24 checks against real Figma; needs the plugin + Allow edits
node tools/live-check-draw.mjs <outDir>     # 34 checks of Draw, Prototype, Motion (raw Plugin API + the 3 tools) incl. known limits; click Switch in the panel to pair with the run
node tools/demo-all-tools.mjs <outDir>      # calls every tool once against the open file

# Rebuilding a Figma frame as HTML (the build/partners pipeline)
node tools/plan-assets.mjs <dump.json> <outDir>                  # decide which layers become SVG/PNG assets
node tools/merge-code-connect.mjs <dump.json> <map.json> <out>   # attach code mappings to instances
node tools/figma-to-html.mjs <design.json> <outDir> <assets.json>
node tools/make-viewer.mjs <design.json> <outDir> [render.png] [code-map.json]

node design-run.js designs/<name> --check   # compile-check a design folder only
node design-run.js designs/<name> [--replace <sectionNodeId>]
```

No single-test runner: `test.js` is one script with a local `test(name, fn)` helper; comment out calls to run one. Tests set `FIGMA_WRITE_NO_STAMP` and a random port so they never touch the real `plugin/ui.html` or the live bridge.

**Env:** `FIGMA_WRITE_PORT` (pins one port; default is the first free of 3692-3699) · `FIGMA_WRITE_EAGER=1` binds at start · `FIGMA_WRITE_LIBRARY_DIR` redirects the shader and plugin library · `FIGMA_PROJECT_DIR` / `FIGMA_SNAPSHOT` point the no-seat tools at a project · `FIGMA_TOKEN` enables REST reading (or `%LOCALAPPDATA%\webority-figma-mcpigma-token`; a repo `.figma/token` only when git ignores it) · `FIGMA_WRITE_TOKEN_FILE` moves the bridge token · `FIGMA_REST_CACHE` moves the REST cache · `KEEP_TEST_PAGE=1` keeps the live-check page · `FIGMA_WRITE_LAYA_URL` (+ optional `FIGMA_WRITE_LAYA_KEY`) adds Laya picks to Code Connect suggestions (see the MCP README) · `FIGMA_CREATIVE_DIR` moves the Creative inbox (default `%USERPROFILE%\Pictures\Webority Creative`), `FIGMA_CREATIVE_PROFILE` the isolated browser profile, `FIGMA_CREATIVE_BROWSER` picks the browser (default Chrome, then Edge) · `FIGMA_IMAGE_GEN_URL` / `FIGMA_IMAGE_GEN_TOKEN` change the `figma_generate_image` provider (default pollinations.ai, free, cloud) or add its token.

## Architecture (webority-figma-write)

```
Claude Code --stdio MCP--> server.js --> bridge.js (WS on 127.0.0.1:3692-3699)
        --> plugin/ui.html (iframe, owns the socket) --postMessage--> plugin/code.js (Figma Plugin API)
```

- **Wire protocol:** `{id, command, params}` -> `{id, result | error}`. Tools map to `code.js` `switch` cases (`status`, `selection_brief`, `export`, `execute`, `set_text`, `create_from_spec`, `components`, `code_map_*`, `apply_shader`, `shader_usage`, `render_frame`, `list_children`, `get_metadata`, `get_document`, `get_node`, `find_nodes`, `get_text`, `get_styles`, `get_variable_defs`, `get_image`, `place_image`, `place_media`, `export_motion`, `animation_styles`, `get_css`, `set_variables`). The panel also sends its own requests `{type:"panel", id, action, params}` -> `{type:"panel-reply", id, result | error}`, handled by `bridge.onPanelRequest` = `handlePanelRequest` in `lib/creative.js` (actions `creative_open`, `creative_list`, `creative_file`, `creative_save`, `creative_folder`). Creative placement by the person (`creative-place` panel message) needs the design editor but not Allow edits.
- **Token stamping:** `lib/token.js` keeps the token in `%LOCALAPPDATA%\webority-figma-mcpridge-token` (owner-only ACL; `FIGMA_WRITE_TOKEN_FILE` overrides, tests use it; an old `<install>/.bridge-token` is moved there). `server.js` on every start renders `plugin/ui.template.html` -> `plugin/ui.html`, replacing `__BRIDGE_TOKEN__`, `__BRIDGE_PORTS__` (the manifest port list, identical for every session), `__VERSION__` and `__FONT_B64__` (Zalando Sans, from `plugin/zalando-sans-latin.woff2`, is embedded because the plugin iframe may only reach the local bridge). Edit the template, never `ui.html` (generated, gitignored, owner-only ACL). The token is a secret.
- **Bridge security (`bridge.js`):** Host must be localhost, Origin must be `null`, several plugin connections (files) per bridge: `claim:"free"` is refused with `CLOSE_BUSY` 4409 when the bridge has a file; `claim:"join"` (offered only when the auth challenge lists `features:["join"]`) adds one more file; no claim replaces every file with `CLOSE_REPLACED`. Commands go to the target file (`bridge.targetId`): the first paired, until `useFile`; it falls back to the oldest remaining file on disconnect. Auth is HMAC challenge-response both ways (`{hello, nonce}` -> `{type:"auth-challenge", proof, nonce}` -> `{auth}`); the token is never sent. The panel (`ui.template.html`, pure-JS HMAC) checks the bridge's proof first, then forwards only `{id, command, params}`, so the bridge can never tick Allow edits.
- **Lazy bind + several sessions:** a port is claimed on the first tool call (first free of the manifest ports 3692-3699), so many sessions can register the MCP and only those using Figma hold one. The panel scans the ports and sends `{auth, claim:"free"}`; a bridge that already has a file closes it with 4409 (`CLOSE_BUSY`) and the panel tries the next port. When no session is free, a second pass sends `claim:"join"` to a busy bridge that offers it. The bridge answers a pairing with `{type:"welcome", session, port}` (session = the server's working-folder name). No claim keeps the old replace-with-4000 behaviour.
- **Plugin guards:** writes refused unless "Allow edits" is ticked, and never in Dev Mode. Commands run serially; each call is one undo step.
- **Activity log:** `plugin/code.js` `postActivity` sends a readable label (`ACTIVITY_NAMES`), the page, the layers touched with a frame path (`activityPath`) and the changes to the panel after every command. Add a name to `ACTIVITY_NAMES` when adding a command.
- **Version handshake:** `VERSION` in `server.js` must match the `// Webority Figma Write (vX)` header in `plugin/code.js`; `figma_write_status` warns on mismatch. Bump both together, and `package.json`.

### Where the tools live

| File | Tools |
|---|---|
| `server.js` | Core 9: status, use_file (several files per session), selection brief, export, export_many, execute, set_text, create_from_spec, color_tokens |
| `lib/tools-read.js` | 8 structured reads, plus `figma_save_snapshot` and `figma_snapshot_code_map`. Every read takes an optional `snapshot` |
| `lib/tools-extra.js` | Code Connect (7), shaders (6), generative plugins (5), `figma_export_video` |
| `lib/tools-open.js` | No-seat access: `figma_access_check`, repo code map (3), `figma_sync_code_map`, REST (3) |
| `lib/tools-figma-features.js` | `figma_draw_style`, `figma_set_prototype`, `figma_set_motion` (plugin commands `draw_style`, `set_prototype`, `set_motion`). Limits a person must handle in Figma: shaders need one hand-applied use, no pattern fill, lasso or shape builder, overlay settings and sticky layers are read-only, Play and the Motion playhead are Figma's, exports show the resting state |
| `lib/tools-creative.js` | `figma_creative_inbox`, `figma_creative_place` (plugin command `place_media`). Browser launch, inbox and `CREATIVE_RULES` in `lib/creative.js`. No tool opens the browser; that is the person's click |
| `lib/tools-image.js` | `figma_generate_image` (provider call in `lib/image-gen.js`; plugin command `place_image`) |
| `lib/tools-figma-2026.js` | Figma's Jul to Oct 2026 Plugin API: `figma_export_motion` (`exportAsync` MP4/GIF/WEBM, top-level frames only), `figma_animation_styles` (custom animation styles), `figma_get_css` (`getCSSAsync`), `figma_set_variables` (composed colour, EASING, TIMING, @aliases). Vertical wrap, `SPACE_EVENLY`/`SPACE_AROUND`, `textWrapStyle` and variable font axes are `figma_create_from_spec` options. Typings: `@figma/plugin-typings` `plugin-api.d.ts` |
| `lib/tools-references.js` | `figma_place_references`, prompt `design_with_references`. Downloads Mobbin (or any https / local) images and builds the board through the `execute` command, so no plugin change. `REFERENCE_RULES` (when to search Mobbin first) and the board script live in `lib/references.js`. The Mobbin MCP is a separate claude.ai connector; this server never calls it, Claude does |
| `lib/tools-design.js` | `design_review`, `design_personas`, prompts `persona_<id>` (8) and `design_panel`. Checks live in `lib/design-review.js` (pure, unit-tested), personas in `lib/design-personas.js` |
| `lib/tools-laya.js` | `laya_status`, `laya_decide`. The when-to-use policy is `LAYA_RULES` in `lib/laya.js`, sent as the MCP server instructions and in both tool descriptions; edit it there only |

Supporting libraries: `lib/color-tokens.js` (the 46 default colour tokens: 39 from Social Media Library node `1080:63` plus the `primary` brand-blue scale; `create_from_spec` resolves token names to hex server-side, the rules text is appended to the server instructions, `design_review` reports `offTokenColors`), `lib/shaders.js` (pixel shaders rendered to PNG in a `vm` sandbox), `lib/png.js`, `lib/video.js` (ffmpeg-static), `lib/code-scan.js` (local component scanner for mapping suggestions), `lib/library.js` (shader and generative-plugin store in `library/`), `lib/code-map-repo.js` (`.figma/code-map.json`), `lib/snapshot.js` (design snapshots and project lookup), `lib/rest.js` (REST reading with a monthly-budget-aware cache).

### Reading and Code Connect without a Figma seat

The plugin needs edit access, and Figma gives View and Collab seats only about **20 file or image REST requests a month**. So for a developer on a free, view-only seat:

1. Someone with access runs `figma_save_snapshot` with `savePath: <repo>/.figma/design-snapshot.json` and `codeMapRepo: <repo>`, and commits `.figma/`.
2. The viewer calls the normal read tools with no arguments. When no plugin is connected, they answer from the snapshot found through `FIGMA_SNAPSHOT`, `FIGMA_PROJECT_DIR`, or the nearest `.figma` folder walking up from the working directory.
3. `figma_get_code_connect_map` merges the snapshot's map with `.figma/code-map.json`, resolving an instance to the component behind it. `figma_add_code_connect_map` saves into the repo instead of failing; `figma_sync_code_map` pushes those into Figma later.
4. `figma_access_check` tells any teammate what works on their machine.

Write tools still refuse without the plugin, which is correct: a viewer cannot change the file.

## Rebuilding a Figma frame as HTML

`build/partners` is the worked example, at **0.927 SSIM** against Figma's own render, verified with `ffmpeg ... ssim`. Lessons baked into `tools/figma-to-html.mjs`:

- Place layers by the **absolute box** (`abs`), not `x`/`y`: inside a GROUP those are relative to the parent frame.
- A text layer's fills are ink, not a background.
- Font stacks and `url(...)` inside a `style="..."` attribute must use single quotes, or the attribute ends early and the style is silently dropped.
- CSS paints the first background layer on top; Figma paints `fills[0]` at the bottom, so reverse them.
- Per-side stroke weights (`strokeWeights`) draw single dividers; a single `border` turns a divider grid into boxes.
- Figma exports a rotated container the way it draws it, so flatten rotated containers and masked mockups to one image and never re-rotate them. Never flatten anything containing text.
- A one-line box with a stray carriage return renders on one line in Figma; use the box height to decide.

## Design folders (`designs/<name>/`)

`design-run.js` runs `preamble.js` then every `s<N>*.js` in sort order, each as a separate `execute` call (async body with `figma` and `SECTION_ID` in scope). It prepends `const ISX = <icons.json>` and `const B64 = {...}` built from `assets/<id>.jpg` for any quoted 4-10 digit id the step mentions. `s0-section.js` typically creates the section and returns its id, which later steps receive via `SECTION_ID`. Preambles define shared helpers (font resolution, `rgb`/`solid`/`grad`/`shadow`, auto-layout `row`/`col`/`sizing`, text `t`) and throw a clear error when a required font is missing.

## Figma Plugin API gotchas

- `figma.loadFontAsync` before any text edit; the font must be installed.
- Image fills via `figma.createImage(bytes)`, max 4096 px.
- OpenType features cannot be set; copy a layer that has them.
- Under `documentAccess: dynamic-page`, an instance's main component needs `getMainComponentAsync`, and pages need `loadAsync` before `findAll`.
- A component published from a library is read-only here: `setSharedPluginData` fails, so its code mapping has to be saved in the library file or the repo store.
- Large loops block Figma's main thread: batch work across calls.
- The plugin must be imported from `webority-figma-write/plugin/manifest.json` and kept open in the design editor.
