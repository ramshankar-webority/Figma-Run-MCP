# Webority Figma MCP · v1.7.0 (61 tools)

Lets Claude **read and write the Figma file open in Figma desktop**: create layouts, edit text, run any Figma Plugin API code, and export images to check its own work. It runs entirely on your PC through a small Figma plugin, so there are **no Figma MCP rate limits** and no plan restrictions beyond having edit access to the file.

Proven on 15-Sep-2026: built the Capnix social carousels (22 posts) and the Pulse music player screens in real Figma files.

---

## 1. Install (once per machine)

**Needs:** Figma desktop app, Node.js 20+, Claude Code.

```bash
# 1. dependencies (already installed in this folder)
cd "C:/Dev/Figma Run MCP/webority-figma-write"
npm install

# 2. register with Claude Code for all projects
claude mcp add -s user Figma-MCP-Webority -- node "C:/Dev/Figma Run MCP/webority-figma-write/server.js"

# 3. restart Claude Code (or /clear) so the tools load
```

**Import the plugin in Figma** (once):
Figma desktop → open any design file → right-click canvas → **Plugins → Development → Import plugin from manifest…** →
`C:\Dev\Figma Run MCP\webority-figma-write\plugin\manifest.json`

> If you used the earlier prototype, remove **"Webority Figma Write (prototype)"** from Plugins → Development → Manage plugins in development. The final plugin is a separate entry named **Webority Figma MCP** (it was called "Webority Figma Write" before 23-Sep-2026; the plugin id is unchanged, so no re-import is needed).

---

## 2. Use it

1. Open the Figma file and make sure you are in the **design editor** (right sidebar shows **Design / Prototype**, not Inspect / Plugins). Press **Shift + D** to leave Dev Mode.
2. Right-click canvas → **Plugins → Development → Webority Figma MCP**. A floating panel opens.
3. Tick **Allow edits** when you want Claude to change the file. Untick to lock it.
4. Ask Claude, e.g. *"Build a pricing card on this page"*, *"Change every ₹ amount in this frame"*, *"Export frame 826:2 so you can check it"*.

The panel turns green once Claude makes its first Figma call ("Connected to Claude"). Until then it shows a grey "Waiting for Claude…" and retries every 2 seconds; that is normal.

**The panel** (title bar "Webority Figma MCP", heading "Figma MCP", set in Zalando Sans):
- **Counters:** CALLS, EDITS and ERRORS for this session.
- **Activity log:** one row per call, with a plain name ("Read layer", "Edited text", "Created layers", "Searched layers", "Ran script" and so on) instead of the raw command. Click a row to expand it: the page, each layer touched (name, type, id, size) with its location as a frame path, what changed, and any error.

---

## 3. Tools

All 61 tools, grouped: core 9, reading 10, Code Connect 7, shaders 6, generative plugins 5, video 1, image generation 1, design references 1, Figma 2026 additions 4, Creative 2, Draw, Prototype and Motion 3, open access 8, Laya decisions 2, design review 2. Plus 10 prompts (design personas, and `design_with_references`). "Needs Allow edits" means the tick box in the plugin panel.

### Core (8)

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_write_status` | No | No | Connection, file, page, editor type, selection count, Allow edits state, plugin vs server version |
| `figma_use_file` | No | No | Lists the Figma files connected to this session and picks the one every call goes to (by name or id). A file whose panel finds no free session joins this one; the first file stays the target until you switch |
| `figma_get_selection_brief` | No | No | Ids, names, sizes and parent of the current selection |
| `figma_export` | No | No | Render a node to PNG, JPG or SVG, optionally saving it |
| `figma_export_many` | No | No | Export up to 500 nodes to files in one call, returning only a manifest |
| `figma_execute` | Yes | Yes | Run any Plugin API JavaScript. One undo step per call |
| `figma_set_text` | Yes | Yes | Replace text in one or many layers, fonts loaded automatically |
| `figma_create_from_spec` | Yes | Yes | Build a layer tree from JSON: frames, auto layout (horizontal or vertical wrap with `wrapGap`, space between/evenly/around), fills, text (variable font axes via `variation`, `wrapStyle` BALANCE or PRETTY). Colours take hex or a colour token name |
| `figma_color_tokens` | No | No | The 46 default colour tokens with hex, grouped, plus usage and contrast rules |

**Default colour tokens** (`lib/color-tokens.js`, from the Social Media Library colour sheet, node `1080:63`). The server teaches them to Claude on connect, and `figma_create_from_spec` accepts the names wherever it takes a colour (`fill: "info-100"`, `text.color: "heading"`); unknown names are refused with the list. `design_review` reports fill colours outside the tokens as `offTokenColors` (not scored).

| Group | Tokens |
|---|---|
| Ink | `heading` #071437, `text-1` #252F4A, `text-2` #4B5675, `text-3` #78829D, `text-4` #99A1B7, `text-5` #C4CADA, `white` #FFFFFF |
| Surfaces | `border-dark` #EBEDF3, `border-light` #F4F6F8, `bg-dark` #F5F6FA, `bg-light` #F9FBFC |
| Primary (brand blue) | `primary-active` #193EE4, `primary-100` #2F50E4, `primary-50` #97A8F2, `primary-30` #C1CBF7, `primary-20` #D5DCFA, `primary-10` #EAEEFC, `primary-5` #F5F6FE. Not on the colour sheet: from the panel palette, tints mixed toward white. White text passes 4.5:1 on `-100` and `-active` |
| Status | `info-*`, `warning-*`, `success-*`, `error-*`, each `-active`, `-100`, `-50`, `-30`, `-20`, `-10`, `-5` |



## Developers on a free plan with view-only access

They cannot run the plugin (it needs edit access) and Figma gives View and Collab seats only about **20 file or image REST requests a month**. The MCP handles that for them: **the same read and Code Connect tools work, with no Figma access at all.**

**Setup, once per project.** Someone who can open the file runs:

```
figma_save_snapshot  savePath: <repo>/.figma/design-snapshot.json  codeMapRepo: <repo>
```

Commit `.figma/`. That is it. Never commit a personal access token: add `.figma/token` to `.gitignore` (the REST tools refuse a repo token that git does not ignore).

**After that, a view-only developer just calls the tools.** No arguments, no token, no Figma open:

| They call | What happens |
|---|---|
| `figma_access_check` | Says exactly what works on their machine and what to do next |
| `figma_get_metadata`, `figma_get_document`, `figma_get_node`, `figma_find_nodes`, `figma_get_text`, `figma_get_styles`, `figma_get_variable_defs` | Answered from the snapshot when no plugin is connected. Pass `snapshot` to point at a different one |
| `figma_get_code_connect_map` | Reads `.figma/code-map.json` plus the snapshot, resolving an instance to the component behind it |
| `figma_add_code_connect_map` | Saves into the repo store instead of failing, and says how to push it into Figma later |
| `figma_snapshot_code_map` | Every mapping in the snapshot |
| `figma_rest_file`, `figma_rest_images` | Optional: live reads with their own token, cached, within the monthly seat budget |

The snapshot is found automatically: `FIGMA_SNAPSHOT`, else `FIGMA_PROJECT_DIR`, else the nearest `.figma` folder walking up from the working directory.

**Verified with no plugin connected:** metadata returned "snapshot | Webority Partners V_2.0 | 1129 layers", a text search found its layers with paths, `figma_get_node` returned Zalando Sans SemiBold 16px on `#252f4a`, variables returned the three brand colours, and `figma_get_code_connect_map` for node `3444:5120` returned `AppButton` from the repo store.

### Open access: readers without a Figma seat (8 tools)

The plugin needs edit access, and Figma gives View or Collab seats only about **20 file or image REST requests a month**, so free teammates cannot drive Figma live. These tools give them the design anyway.

| Tool | Does |
|---|---|
| `figma_access_check` | What this machine can do right now: plugin, snapshot, REST token and budget, repo mappings, and the route that works |
| `figma_get_repo_code_map` | Read Code Connect mappings stored in a repo (`.figma/code-map.json`), no Figma access needed |
| `figma_set_repo_code_map` | Save a mapping in the repo instead of the file, reviewable in a pull request |
| `figma_remove_repo_code_map` | Remove one |
| `figma_sync_code_map` | `pull` copies the file's mappings into the repo, `push` writes the repo's mappings into Figma (needs edit access) |
| `figma_rest_status` | Whether a personal access token is present and how many REST calls this machine spent this month |
| `figma_rest_file` | Read a file or node through the REST API with the reader's own token, cached on disk |
| `figma_rest_images` | Render nodes to images through REST, optionally downloading them |

**Offline design viewer:** `node tools/make-viewer.mjs <design.json> <outDir> [render.png] [code-map.json]` builds a single `viewer.html`: layer tree, search across names and copy, a click-to-highlight canvas over the exported render, and a specs panel with size, sizing, constraints, auto layout, fills with hex, type, variables, styles, component properties, the code mapping and copyable CSS. It opens with no Figma account, no seat, no token and no network.

### Reading a design (10 tools)

Richer than the read-only weborityos plugin on port 3691: these also return Fill/Hug sizing, min and max, constraints, component and variant properties, the main component behind an instance, line height and letter spacing, mixed text runs, style links by name, bound variables by name, per-corner radius, blend mode, rotation, masks and prototype links.

| Tool | Does |
|---|---|
| `figma_get_metadata` | Every page with its layer count and top-level frames |
| `figma_get_document` | A page's layer tree, with depth and node limits |
| `figma_get_node` | One layer in full detail, with children |
| `figma_find_nodes` | Find layers by name, type or text, with their layer path |
| `figma_get_text` | Every text layer with content, font, size, colour and style |
| `figma_get_styles` | Local paint, text, effect and grid styles |
| `figma_get_variable_defs` | Variable collections, modes and values, aliases resolved |
| `figma_save_image` | The original bytes behind an image fill |
| `figma_save_snapshot` | Save the whole design to one JSON file, so every read tool works later with no Figma at all |
| `figma_snapshot_code_map` | The code mappings baked into a snapshot: which component each layer uses, and its code component |

### Code Connect (local, works on the Pro plan)

Figma's own Code Connect needs an Organization or Enterprise plan. These tools store the mapping **inside the Figma file** instead. Anyone can see it in Dev Mode by choosing the **Webority code map** code generator. A source that is an https URL is also added as a Dev Mode link.

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_list_file_components_for_code_connect` | No | No | Components and component sets, their properties, variants and current mapping |
| `figma_get_code_connect_map` | No | No | One component's mapping and code preview, or every mapped component |
| `figma_add_code_connect_map` | Yes | Yes | Map one component to a code component (name, source, import, prop names, template) |
| `figma_send_code_connect_mappings` | Yes | Yes | Save many mappings at once, with a result per item |
| `figma_remove_code_connect_map` | Yes | Yes | Remove a mapping |
| `figma_get_code_connect_suggestions` | No | No | Scan a local code folder and suggest matches with a confidence score |
| `figma_get_context_for_code_connect` | No | No | Props, mapping, image, the mapped source file and match candidates for one component |

**Optional Laya matching.** Name matching misses synonyms such as Toggle for `Switch` or Modal for `Dialog`. [Laya](https://github.com/NandhaKishorM/laya) is an open decision model that runs on your own PC, and it can suggest those matches. Set `FIGMA_WRITE_LAYA_URL` to a running `laya-serve` and both tools above add Laya's pick where name matching is not sure. Laya's picks are marked `method: "laya"`. Its confidence is uncalibrated, so review each pick before saving. Set `FIGMA_WRITE_LAYA_KEY` when the server needs a bearer key. Without the URL nothing changes. In a test on 22 components it matched 17, against 8 for name matching alone, at about 3 seconds per component on a CPU.

```bash
python -m venv laya-venv && laya-venv/Scripts/pip install torch --index-url https://download.pytorch.org/whl/cpu && laya-venv/Scripts/pip install "laya[serve]"
LAYA_HOST=127.0.0.1 LAYA_PORT=8765 LAYA_MODELS=english laya-venv/Scripts/laya-serve   # then FIGMA_WRITE_LAYA_URL=http://127.0.0.1:8765
```

### Creative tab

The plugin panel has two tabs. **Design** is everything above: the live session, Allow edits, counters and the activity log. **Creative** is for making social media creatives (and any other image or video work) with ChatGPT or Gemini, by hand:

- **Open ChatGPT / Open Gemini** starts an isolated Chrome (or Edge) window with its own profile in `%LOCALAPPDATA%\webority-figma-mcp\creative-browser`. Sign in once; it is remembered and never touches your normal browser. No automation flags, so Google sign-in works, and nothing is generated for you.
- **Inbox:** a new profile saves downloads to `%USERPROFILE%\Pictures\Webority Creative` (`FIGMA_CREATIVE_DIR` moves it). The tab lists the newest 20 images and videos with thumbnails and refreshes every 4 seconds. **Open folder** shows it in Explorer.
- **Place** puts a file in the file. **Place as** picks: fill the selected layers, a new layer at the original size, or a new frame at a social size (Instagram 1:1 and 4:5, Story or Reel 9:16, LinkedIn, X, YouTube thumbnail, Facebook cover). It is your own click, so it needs no Allow edits; one undo step. WEBP and images over 4096 px are converted to PNG in the panel.
- **Paste or drop:** copy an image in ChatGPT or Gemini and press Ctrl+V in the tab, or drop a file. It is saved to the inbox and placed.
- **No Claude session running:** the buttons open the sites in your normal browser (not isolated) and paste still places images.

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_creative_inbox` | No | No | Lists the inbox, newest first, plus the social sizes |
| `figma_creative_place` | Yes | Yes | Places an inbox file as the fill of `nodeIds`, or as a new layer at a social `size`. Images and videos (videos need a paid plan) |

Claude never opens the isolated browser itself; that stays your click. Ask it things like "put the Gemini image I just made into a 4:5 Instagram post with the headline in heading colour".

### Laya decisions

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `laya_status` | No | No | Whether Laya is on and reachable, which checkpoints are loaded, and the usage rules |
| `laya_decide` | No | No | Typed questions (choice, score, yes/no) over one state or up to 200 at once, each answer with a probability |

**When a model should use Laya.** The rules live in one place, `LAYA_RULES` in `lib/laya.js`. The server sends them as its MCP instructions when a client connects, and the two tools repeat them in their descriptions. So any model that uses this MCP gets them.

- **Use Laya** for many small closed decisions over short text. Examples: which code component matches, what role each layer plays, whether a layer exports as SVG or PNG, or a yes/no audit across hundreds of layers.
- **Do not use Laya** for creative work (layout, copy, naming, code), for a single decision the model can make itself, or for anything that needs images or long reasoning.
- **Verify first.** Laya's confidence is not calibrated. A model checks its answer before any Figma write, and never makes a destructive change on Laya alone.
- **When Laya is off.** A model says so once and falls back to its own judgment.

### Design review and personas

| Tool or prompt | Does |
|---|---|
| `design_review` | Scores a frame, section or screen set out of 100 in five areas, with a finding per layer id, the persona who owns it, and a fix. It reads live through the plugin, or from a snapshot when no plugin is connected |
| `design_personas` | The 8 personas: lens, standing questions, owned rules, and where each uses Laya. For clients that cannot run MCP prompts |
| `persona_<id>` prompts | Review as one expert: `strategist`, `researcher`, `interaction`, `visual`, `systems`, `accessibility`, `writer`, `critic` |
| `design_panel` prompt | All 8 personas review the frame, then the Design Critic ranks the top 5 changes |

**The five areas and their checks:**

| Area | Checks | Owner |
|---|---|---|
| Accessibility | WCAG contrast (4.5:1, or 3:1 for large text), 44 px touch targets, 12 px minimum text | Accessibility Specialist |
| Visual | Text overflow, type scale, font families | Visual and UI Designer |
| Hierarchy | One primary action per screen | Interaction Designer |
| Content | Placeholder copy, long all-caps text | UX Writer |
| System | 4 px spacing grid, colour count | Design Systems Lead |

**How it works:**

- **Scores are pass rates.** 90 findings across 900 texts is not a zero.
- **Contrast failures are grouped by text colour.** Each group suggests the nearest colour that passes, so a failing token is fixed once.
- **Laya's role.** When Laya is on, it sorts ambiguous boxes into control, status, layout group or decoration. A target that only Laya found can warn but never fail.

**First run, 23-Sep-2026:**

- V1 scored 91 and V2 scored 89.
- V2 is better on accessibility (84 against 81), and on visual through fewer overflows.
- V2 loses points on colour count.
- Both share the main issue: the grey `#78829D` gives 3.55:1 in 71 texts, and the suggested fix is `#677087`.

### Shaders

The Figma Plugin API has no GLSL shaders. A Webority shader is a saved recipe with two optional parts. **Pixel code** is a small JavaScript function rendered on your PC into an image fill (up to 4096 px). **Effects** are native Figma glass, noise, texture, glow, shadow and blurs. Built-ins: every effect, plus **Aurora gradient** and **Film grain**. Your shaders are saved in `library/shaders/`.

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_create_shader` | Library | No | Save a new shader, returns a preview image |
| `figma_get_shader` | No | No | One shader with its code and a preview |
| `figma_update_shader` | Library | No | Change a shader, bumps its version |
| `figma_list_shaders` | No | No | Built-in and library shaders |
| `figma_list_file_shaders` | No | No | Which layers in the file use which shader, and which are behind the latest version |
| `figma_apply_shader` | Yes | Yes | Render and apply a shader to layers, with param overrides |

### Generative plugins

Saved, reusable Plugin API scripts with parameters, for example "12-column grid" or "avatar placeholders". Saved in `library/generative-plugins/`. They are not Figma's cloud AI plugins; Claude writes the code once and you rerun it on any file.

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_create_generative_plugin` | Library | No | Save code plus parameter definitions |
| `figma_get_generative_plugin` | No | No | Code, parameters, version, run count |
| `figma_update_generative_plugin` | Library | No | Change it, bumps its version |
| `figma_list_generative_plugins` | No | No | Everything saved |
| `figma_run_generative_plugin` | Yes | Yes | Run it on the open file with parameters |

### Video

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_export_video` | File on disk | Only for `animate` | MP4, WebM or GIF from a list of frames, the children of a section, or an animation script run on a temporary copy of a layer. Uses the bundled ffmpeg |

### Draw, Prototype and Motion

Figma's newer features, driven from Claude. Each call is one undo step and shows in the panel log. `tools/live-check-draw.mjs` re-checks the underlying Plugin API against real Figma.

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_draw_style` | Yes | Yes | Draw styling on existing layers: brush strokes (15 stretch brushes such as NOIR, VERITE, HARDBOILED, with direction; 10 scatter brushes such as SHOEGAZE, SPOKEN_WORD, with gap, wiggle, jitter, rotation and size jitter), the pencil's wobbly stroke, variable width (6 profiles or custom points), stroke colour and weight, effects (noise in 3 types, texture, glass, progressive blur, a shader effect copied from a layer that uses one), text on a path, and union, subtract, intersect, exclude or flatten |
| `figma_set_prototype` | Yes | Yes | Prototype links from a layer: every trigger (click, hover, press, drag, mouse enter/leave/up/down with delay, after a timeout, key press, video end), actions (navigate, overlay, swap, scroll to, change to a variant, back, close, open a link), transitions (instant, dissolve, smart animate, scroll animate, move/push/slide from any side) and easings (11 presets, cubic bezier, spring). Also flow starting points, scrolling frames with fixed top layers, clearing links, and raw reactions for variables and if/else logic |
| `figma_set_motion` | Yes | Yes, except `listPresets` | Figma Motion on layers: the 6 presets (Position, Scale, Rotation, Size, Opacity, Path) with custom settings, keyframe tracks on 30 properties (move, rotate, scale, size, opacity, corner radius, spacing, path trim), a fill colour or an effect value, an easing per keyframe, timeline length, and clearing |

**What only a person can do in Figma:** lasso select and shape builder (`figma_draw_style` booleans reproduce shape-builder results), pattern fills, overlay position and background, sticky layers, pressing Play, and moving the Motion playhead. Exports always show a layer's resting state, so Motion is previewed in Figma.

**Shaders need one hand-applied use.** Code cannot import a shader, not even Figma's built-in ones. Apply a shader effect or fill to any layer once by hand; after that `figma_draw_style` (`effects: [{ type: "shader", copyFromNodeId }]`) or `figma_execute` can reuse it, change its settings, and stack it with other effects. Shader settings have hashed names, so find each one by trying values.

**Hover and press links** need `change_to` on a variant (interactive components) or an overlay; Figma rejects `back` on them.

### Image generation

| Tool | Writes? | Needs Allow edits | Does |
|---|---|---|---|
| `figma_generate_image` | Yes | Yes | Generates an image from a prompt and places it: as the image fill of `nodeIds`, or as a new selected rectangle (inside `parentId`, else next to the selection). Sizes itself to the target layer at 2x. Stores prompt and seed on the layer; the same seed repeats the image. Returns the image; `savePath` also writes the file |
| `figma_place_references` | Yes | Yes | Puts design references on a board next to the frame being designed (`nextTo`, else the selection): each an https image (a Mobbin result `image_url`, searched with `image_format` jpg) or local file, captioned with its title linked to `sourceUrl` and a note. Pairs with the Mobbin MCP; prompt `design_with_references` runs search, board, design and review |
| `figma_export_motion` | No | No | Exports a top-level frame's Motion animation as MP4, GIF or WEBM rendered by Figma itself (fps, quality, loop count, scale or fixed size, 4K cap), saved to `savePath`. Code-driven animations stay on `figma_export_video` |
| `figma_animation_styles` | Yes | Yes (not `list`) | Custom animation styles: list Figma's presets and the file's styles, create a named style from presets, apply it to layers with an offset and per-layer stagger, delete it |
| `figma_get_css` | No | No | The CSS Figma's inspect panel shows, per layer and optionally down the tree (`depth`), for design-to-code |
| `figma_set_variables` | Yes | Yes | Creates or updates variables in a collection and mode: colour (hex, token name, or colour + opacity with a variable side), number, string, boolean, Motion easing and timing; `@name` aliases another variable; optional scopes such as `COLOR_OPACITY` |

The prompt goes to **pollinations.ai** (free, no key, cloud), not a local model. It checks the target before generating, so nothing is sent when Figma cannot take the result. Free images carry a small Pollinations logo in the corner; save a free Pollinations token (auth.pollinations.ai) in `%LOCALAPPDATA%\webority-figma-mcp\image-gen-token`, or set `FIGMA_IMAGE_GEN_TOKEN`, to remove it and raise the rate limit. `FIGMA_IMAGE_GEN_URL` points the tool at another server with the same `GET /prompt/<text>?width&height&seed&model` shape.

**Size:** the free tier may return a smaller image than asked (1024 x 768 came back as 886 x 665 in testing). A new rectangle takes the image's real size, capped at 1024 on its long side. As a fill, `scaleMode: FILL` covers the layer either way.

---

## 4. Safety

- **Local only:** listens on `127.0.0.1` / `::1`, never the network. Each session takes the first free port of 3692-3699.
- **Several files at once:** run one Claude session per Figma file. Each file's panel pairs with a session that has no file yet and never takes a busy one. The panel shows the session's folder and port; **Switch** hands the session back and pairs the file with another.
- **Access checks on every connection:**
  - The Host header must be localhost (blocks DNS rebinding).
  - The Origin must be `null`, the Figma plugin iframe (blocks web pages).
  - A per-user secret token, proven both ways and never sent: the plugin checks that the bridge knows it before it answers anything, so a program squatting on the port learns nothing and cannot drive the file. The token lives in `%LOCALAPPDATA%webority-figma-mcpridge-token` (readable only by you) and is stamped into `plugin/ui.html`, which is also locked to you.
- **One plugin window at a time:** a newer window takes over, and the old one shows "Another Figma window took over", so writes never land in the wrong file.
- **Edits are opt-in:** refused unless **Allow edits** is ticked, and always refused in Dev Mode. Only the tick box can turn it on; the panel drops any other message that tries to, and the tick box always shows the real state.
- **Undo:** every call is one Ctrl+Z.
- **Image generation is the one cloud call:** `figma_generate_image` sends its prompt (and nothing from the file) to pollinations.ai, or to the server in `FIGMA_IMAGE_GEN_URL`. Its image-gen token sits next to the bridge token in `%LOCALAPPDATA%\webority-figma-mcp\`; keep it private too.
- **Creative tab:** panel requests are accepted only from the authenticated plugin and only for a fixed set of actions (open the browser, list, read, save, open the folder). Inbox reads and saves take a bare file name inside the inbox, check the real file type from its first bytes, and stop at 40 MB. The isolated browser uses its own profile in `%LOCALAPPDATA%\webority-figma-mcp\creative-browser`, and only your click opens it; no tool does.
- **Destructive tools** (`figma_execute`, `figma_set_text`, `figma_generate_image`) are flagged, so Claude Code asks before running them unless you allow them.
- **Keep the bridge token private.** Delete `%LOCALAPPDATA%webority-figma-mcpridge-token` to rotate it; restart Claude Code, then reopen the plugin. An old `.bridge-token` in this folder is moved there on first start.
- **Shader pixel code is sandboxed:** it runs in a separate Node process with no file system, no child processes, no string eval and an empty environment, inside a context that gets no host objects.
- **Mapped source files:** `figma_get_context_for_code_connect` reads a mapping's source only inside the `sourceDir` you pass, and only code files, because the Figma file sets that path.
- **Offline viewer:** `make-viewer.mjs` escapes every design string and sets a Content Security Policy, so a hostile layer name cannot run script.
- **Install location:** on a shared PC, install under your own user profile. A folder such as `C:Dev` is often writable by every account on the machine, which lets another account change the server code.

---

## 5. Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| Panel: "Waiting for Claude…" (grey) | Normal idle state: no Claude session has made a Figma request yet, or the session ended | Ask Claude anything in Figma, e.g. run `figma_write_status` |
| Panel: "Rejected: token mismatch" | Token rotated or old plugin copy | Close and reopen the plugin |
| Panel: "Another Figma window took over" | Plugin open in a second file | Keep it open in one file; click Reconnect in the one you want |
| Red line "DEV MODE: read-only" | Plugin opened in Dev Mode | Close plugin, Shift + D, reopen in design editor |
| "Edits are off" | Allow edits unticked (it resets every time the plugin opens) | Tick Allow edits |
| "Port 3692 is already in use" | `FIGMA_WRITE_PORT` pins one port and another session holds it | Unset it, or use that session |
| "Ports 3692-3699 are all in use" | Eight sessions already hold a port | Close one of them |
| A file paired with the wrong session | Panels pair with the first free session | Click **Switch** in that file's panel |
| Manifest error "editorType does not include dev" | Old prototype manifest | Import this folder's `plugin/manifest.json` |
| Creative: "No Chrome or Edge found" | Neither browser is in the usual install folders | Set `FIGMA_CREATIVE_BROWSER` to a Chromium browser's `.exe` |
| Creative: downloads do not appear in the inbox | The isolated profile existed before, so its download folder was left as you set it | Point its download folder at `%USERPROFILE%\Pictures\Webority Creative`, or save into it |
| `figma_status` in weborityos shows a different file | That is the separate read-only Webority plugin on port 3691 | Both can run side by side |

**Plugin API limits to know:** fonts must be available in Figma; OpenType features (e.g. lining figures) can't be set directly (copy a layer that has them and edit its characters); image fills need bytes passed in code (≤ 4096 px); huge loops block Figma until they finish.

---

## 6. Files

| Path | Role |
|---|---|
| `server.js` | MCP server (stdio), the core 8 tools, lazy port bind, version 1.5.0 |
| `bridge.js` | Secure WebSocket bridge (Host, Origin, token, single plugin, shared bind) |
| `plugin/manifest.json` · `code.js` · `ui.template.html` | Figma plugin (`ui.html` is generated with the token and font) |
| `plugin/zalando-sans-latin.woff2` | Panel font, embedded into `ui.html` because the plugin window cannot load web fonts |
| `icons/iconsax/` | All 993 Iconsax icons in 6 styles (`linear`, `outline`, `bold`, `bulk`, `broken`, `twotone`), 5,958 SVGs, 24×24, `currentColor`, plus `index.json`. From the MIT-licensed `iconsax-react` 0.0.8 package |
| `lib/tools-read.js` | 10 structured reads, including `figma_save_snapshot` and `figma_snapshot_code_map`. Every read accepts a `snapshot` |
| `lib/tools-extra.js` | 19 tools: Code Connect (7), shaders (6), generative plugins (5), video (1) |
| `lib/tools-open.js` | 8 no-seat tools: access check, repo code map (3), sync, REST reading (3) |
| `lib/color-tokens.js` | Default colour tokens, name-to-hex resolution for specs, and the rules taught on connect |
| `lib/creative.js` · `tools-creative.js` | Isolated browser launch, inbox listing, safe reads and saves, panel requests · the two Creative tools |
| `lib/tools-image.js` · `image-gen.js` | `figma_generate_image` · the image provider call (Pollinations by default) |
| `lib/tools-figma-features.js` | `figma_draw_style`, `figma_set_prototype`, `figma_set_motion` (plugin commands `draw_style`, `set_prototype`, `set_motion`) |
| `lib/snapshot.js` · `code-map-repo.js` · `rest.js` | Design snapshots and project lookup, `.figma/code-map.json`, REST with a budget-aware cache |
| `lib/token.js` · `util.js` | Bridge token storage (user profile, owner-only) · shared node-id, save-path, mapping-key and source-path helpers |
| `lib/shaders.js` · `png.js` · `code-scan.js` · `video.js` · `library.js` | Pixel shader renderer, PNG encoder, code scanner, ffmpeg wrapper, JSON library |
| `library/` | Your saved shaders and generative plugins (created on first save) |
| `test.js` | 28 automated checks (`npm test`), including the two-way token handshake, token storage, real ffmpeg encodes, image generation against a local stub, and the no-seat path |
| `tools/live-check-1.1.mjs` | 24 checks against real Figma (needs the plugin and Allow edits) |
| `tools/live-check-draw.mjs` | 34 checks (all passing on 29-Sep-2026) of the Draw, Prototype and Motion Plugin API and the three tools against real Figma, including the known limits (pattern fill, sticky layers, overlay settings, playhead). Shader checks run only when a layer already uses a shader |
| `tools/demo-all-tools.mjs` | Calls every tool once against the open file |
| `tools/plan-assets.mjs` · `figma-to-html.mjs` · `merge-code-connect.mjs` · `make-viewer.mjs` | The Figma-to-HTML rebuild pipeline and the offline viewer generator |
| `design-run.js` · `designs/` | Runs a folder of design scripts against Figma |

**Changelog 1.7.0 (10-Oct-2026): Figma Jul to Oct 2026 API and Mobbin references.** `figma_export_motion` (native MP4/GIF/WEBM), `figma_animation_styles`, `figma_get_css`, `figma_set_variables` (colour + opacity, easing, timing); `figma_create_from_spec` gains vertical wrap with `wrapGap`, `SPACE_EVENLY`/`SPACE_AROUND`, text `wrapStyle` and variable font `variation`; `figma_place_references` and prompt `design_with_references` put Mobbin references on a board next to the design. Several files per session: a panel that finds no free session joins a busy one, and `figma_use_file` picks which file the calls go to. The Creative tab is hidden in the panel (its tools still work).

**Changelog 1.6.0 (29-Sep-2026): Draw, Prototype and Motion tools.**
- **New tools:** `figma_draw_style`, `figma_set_prototype` and `figma_set_motion` cover Figma Draw (brushes, pencil wobble, variable width, noise, texture, glass, progressive blur, shader reuse, text on a path, booleans), prototyping (triggers, actions, transitions, easings, flows, scrolling) and Motion (presets, keyframe tracks, timeline length). All three were probed live against Figma first.
- **New live check:** `tools/live-check-draw.mjs` asserts what the Plugin API accepts and what it rejects, so a Figma change shows up there first.
- **Panel redesign:** white, edge to edge, sections split by thin lines, underline tabs, a slim status row shown on both tabs, smaller controls. The window is 620 px tall (was 700).
- `npm test` has 28 checks (one new test for the three tools; the tool list is 55).

**Changelog 1.5.0 (28-Sep-2026): several Figma files at once.**
- Each Claude session binds the first free port of 3692-3699 instead of failing when 3692 is taken.
- Each file's panel scans those ports and pairs with a session that has no file yet (`claim:"free"`; a busy session answers 4409 and is never taken over).
- The panel shows the paired session's folder and port, and a **Switch** button re-pairs the file with another session.
- `figma_write_status` reports `port` and `session`.
- Panel header: **Reset connection** (drop the session and pair again) and **Minimise** (the window shrinks to a round button with a connection dot; click it to open the panel).

**Changelog 1.4.0 (26-Sep-2026): Creative tab.**
- **Panel:** Design and Creative tabs. Creative opens ChatGPT or Gemini in an isolated browser, lists the inbox, and places files at social sizes; paste and drop work too.
- **New tools:** `figma_creative_inbox`, `figma_creative_place`. **New plugin command:** `place_media` (images and videos). **Bridge:** the panel can now ask the server `{type:"panel", id, action, params}` for a fixed set of Creative actions.
- **Primary colour tokens (28-Sep-2026):** a `primary` brand-blue scale (7 shades, base #2F50E4) joins the defaults, so there are 46 tokens and the Webority blue no longer shows in `offTokenColors`.
- **Verified:** `npm test` 25/25. Not yet tried in Figma.
- **After updating:** restart Claude Code, then close and reopen the plugin.

**Also in 1.4.0 (26-Sep-2026, shipped earlier the same day): default colour tokens.**
- **New tool:** `figma_color_tokens` returns the 39 default tokens from the Social Media Library colour sheet.
- **Specs take token names:** `figma_create_from_spec` resolves names such as `info-100` or `heading` to hex on the server, so the plugin is unchanged.
- **Server instructions** now teach the tokens and their contrast rules; `design_review` lists off-token fills as `offTokenColors`.
- **Verified:** `npm test` 23/23.
- **After updating:** restart Claude Code. The plugin needs no reload.

**Panel update (23-Sep-2026, no version change):**
- **Renamed:** the title bar and Plugins menu now read "Webority Figma MCP"; the panel heading reads "Figma MCP". The plugin id `webority-figma-write`, the folder and the server name are unchanged.
- **Font:** Zalando Sans replaces Bricolage Grotesque, embedded in the panel. Counters use its normal digits, because its fixed-width digits draw a slashed zero.
- **Colours:** the Webority palette (Primary `#2F50E4`, Heading `#071437`, background `#F5F6FA`, Success `#04B440`).
- **Activity log:** readable action names plus layer, frame path and page details for every call.
- **Icons:** the Iconsax set saved locally in `icons/iconsax/`.
- **After updating:** close and reopen the plugin in Figma.

**Changelog 1.3.0 (23-Sep-2026): image generation.**
- **New tool:** `figma_generate_image` turns a prompt into an image and places it as a layer fill or a new rectangle. It uses pollinations.ai (free, cloud), with an optional free token to remove the logo.
- **New plugin command:** `place_image`, which needs Allow edits and is one undo step. It stores the prompt and seed on the layer (shared plugin data `webority` / `imageGen`).
- **Docs:** the tool count is now 49, including the two design review tools.
- **Verified:** `npm test` 22/22, and a live run placed a generated image in a real file.
- **After updating:** restart Claude Code, then close and reopen the plugin so it loads `place_image`.

**Changelog 1.2.0 (23-Sep-2026): fixes and hardening.** The plugin and server handshake changed, so a 1.1.0 plugin cannot connect to a 1.2.0 server.
- **Security:** two-way token handshake (the token is never sent); the panel forwards only commands and only its tick box can allow edits; shader pixel code runs in a locked-down child process; mapped source reads stay inside `sourceDir`; the offline viewer escapes everything and sets a CSP; the bridge token moved to `%LOCALAPPDATA%` with an owner-only ACL; a repo `.figma/token` is used only when git ignores it.
- **Reliability:** read tools wait briefly for the plugin before falling back to a snapshot; calls fail at once when the plugin disconnects; a timed-out `figma_execute` holds the queue until it finishes; offline code-map lookups resolve variants to their set.
- **After updating:** restart Claude Code, then close and reopen the plugin. The old panel cannot talk to the new server.

**Changelog 1.1.0:**
- **No-seat access:** design snapshots (`figma_save_snapshot`), so every read tool answers with no Figma, no plugin and no seat; Code Connect falls back to `.figma/code-map.json`; `figma_access_check` explains what works on a given machine. Verified against the real Partners file, 12/12 checks with the plugin disconnected.
- **Rebuild pipeline:** `plan-assets`, `figma-to-html`, `merge-code-connect` and `make-viewer` turn a frame into a pixel-exact HTML page (0.927 SSIM on the worked example) plus an offline viewer.
- **Open access:** repo-stored Code Connect, REST reading with the reader's own token, and an offline design viewer, so teammates on free or view-only seats can read the design and the code map.
- **Reading:** 10 structured read tools, so this MCP no longer needs the port 3691 plugin for reading.
- **Renamed in Claude Code:** the MCP is registered as `Figma-MCP-Webority` (the folder and plugin names are unchanged).
- **Code Connect (local):** 7 tools. Mappings saved in the file, shown in Dev Mode by the plugin's code generator, suggestions from a local code scan.
- **Shaders:** 6 tools. Pixel code rendered to image fills plus native effects, with a versioned library and per-layer tracking.
- **Generative plugins:** 5 tools. Saved, parameterised Plugin API scripts.
- **Video:** `figma_export_video` for MP4, WebM and GIF, as a slideshow or a scripted animation.
- **After updating:** close and reopen the plugin in Figma so it loads the new commands.

**Changelog 1.0.0** (from prototype 0.1.0):
- **Renamed:** now "Webority Figma Write".
- **New tool:** `figma_export`.
- **Lazy port bind:** multi-session friendly, with a fix for simultaneous tool calls.
- **Version handshake and warning** between plugin and server.
- **Clean shutdown:** the bridge no longer hangs on stop.
- **Test isolation:** tests can no longer overwrite the plugin port.
- **Dev Mode:** the plugin opens there and shows a clear read-only notice.
