# Webority Figma MCP: Codebase Analysis

Analysed 15-Sep-2026 from `Webority/webority-os`, branch `development`. CLI and plugin build **v0.3.21**.
Source copies of every file listed below are in `source/`.

## Summary

The Webority Figma MCP is a small, well-built subsystem of the weborityos CLI: about 73 KB across 9 source files. A C# bridge (`FigmaBridge.cs`) runs a local WebSocket + HTTP server on port 3691, and a TypeScript Figma plugin connects to it and runs read-only Figma API calls. Multiple Claude sessions share one plugin through a leader/follower election. The code is careful about timeouts, reconnects and stale plugins. The main weaknesses are **no authentication on the bridge** (any local program, and possibly a web page, can connect) and **"latest plugin wins"** (two open plugin windows silently switch which file is read). The design data it returns also misses several layout and component details.

## 1. Inventory

| File | Size | Role |
|---|---|---|
| `Webority.Cli/FigmaBridge.cs` | 27.8 KB | Transport: port binding, leader/follower election, WebSocket to plugin, `/ping` + `/rpc` HTTP relay, hand-rolled HTTP parser |
| `Webority.Cli/FigmaTools.cs` | 16.5 KB | The 12 `figma_*` MCP tools: parameter validation, timeouts, image/SVG output, file saving |
| `Webority.Cli/FigmaPluginInstaller.cs` | 3.7 KB | Writes the embedded plugin to `~/.webority/figma-plugin/` on every MCP start, stamps the version |
| `Webority.Cli/FigmaColorHex.cs` | 2.1 KB | Adds `hex` to every `{r,g,b}` colour object in responses |
| `Webority.Cli/FigmaNodeId.cs` | 1.2 KB | Normalises `425-95` / Figma URLs to `425:95` |
| `Webority.Cli.Tests/FigmaBridgeTests.cs` | 6.7 KB | End-to-end bridge tests with a fake plugin |
| `Webority.Cli.Tests/FigmaShapingTests.cs` | 2.0 KB | Node id + hex annotation tests |
| `figma-plugin/src/code.ts` | 10.1 KB | Plugin sandbox: 10 commands, `serializeNode` |
| `figma-plugin/src/ui.html` | 2.6 KB | Plugin UI iframe: WebSocket client, relay, reconnect |
| `figma-plugin/build.mjs`, `package.json`, `tsconfig.json`, `README.md` | small | esbuild to `dist/`, typecheck |

Wiring in `Webority.Cli/McpHost.cs`: line 26 calls `FigmaPluginInstaller.Sync()`, line 55 registers `FigmaBridge` as a singleton, lines 105-109 add the figma guidance to the MCP server instructions.

**Not part of this MCP:** `Webority.Infrastructure/Figma/*`, `FigmaBackupService` and `Functions.Agents/Functions/Figma/FigmaBackupFunction.cs` are a separate server-side Figma REST API backup job. The `*FromFigma.sql` migrations are brand-theme data seeded from Figma.

## 2. History

| Date | Commit | Change |
|---|---|---|
| 15-Aug-2026 | `869b111` | Figma MCP folded into the CLI as the `figma_*` tool family [TASK-06971] |
| 15-Aug-2026 | `aa7e9ca` | Plugin shipped inside the CLI, written to `~/.webority/figma-plugin` [TASK-06971] |
| 15-Aug-2026 | `929c671` | Bridge hardening from peer review [TASK-06971] |
| 18/22-Aug-2026 | `484bea1`, `b03d9ea` | Node version pin, Dependabot fixes |
| 26-Aug-2026 | `872d7ac` | Plugin announces its build so stale copies are detected [BUG-08304] |

Origin: migrated from the retired `Webority/webority-figma-mcp` repo, whose Node MCP server was rewritten in C#. The wire protocol stayed backward-compatible.

## 3. Lifecycle

1. **MCP server starts** (each Claude session): `Sync()` compares the embedded plugin files with `~/.webority/figma-plugin/` and rewrites only what changed. `__WEBORITY_PLUGIN_VERSION__` in `index.html` becomes the CLI version. Figma re-reads dev plugin files on each run, so one manifest import stays current forever.
2. **First `figma_*` call**: the bridge runs the election. Sessions that never touch Figma never bind the port.
3. **Plugin opens in Figma**: `ui.html` connects to `ws://localhost:3691`, sends `{hello, version}`, retries every 2 s on disconnect.
4. **Tool call**: `FigmaTools` validates params, `FigmaBridge.InvokeAsync` sends `{id, command, params}`, the plugin replies `{id, result|error}`, `FigmaColorHex` adds hex, the result goes to Claude.

## 4. Leader / follower design (`FigmaBridge.cs`)

- **Election** (lines 136-175): bind `127.0.0.1:3691` first. Failure means another session leads, so this one becomes a follower. Then bind `[::1]:3691`, because Figma's Chromium resolves `localhost` to IPv6. A v6 failure is reported as an unrelated process holding the port.
- **Leader** serves three endpoints (lines 216-238): WebSocket upgrade (plugin), `GET /ping` (status), `POST /rpc` (follower relay).
- **Follower** (lines 478-519) POSTs to the leader's `/rpc`. If the leader is unreachable it re-runs the election. If it wins, it returns the distinct message "leader changed, retry" so the error does not look like a missing plugin.
- **Timeouts**: send capped at 5 s, then the socket is dropped (lines 443-457). Reply timeout 30 s, or 60 s for document, find, text and exports. Follower HTTP timeout is the reply timeout + 5 s.
- **Correlation**: incrementing id in a `ConcurrentDictionary`. Late replies after a timeout are ignored.
- **Stale plugin detection**: `hello.version` compared with `CliVersion` in `figma_status` (`FigmaTools.cs:48-55`). An "Unknown command" error gets a re-import hint appended (`FigmaBridge.cs:363-367`).

## 5. Verified consistency

| Check | Result |
|---|---|
| Installed `~/.webority/figma-plugin/dist/code.js` vs repo `dist/code.js` | Identical |
| Installed `index.html` vs repo `dist/index.html` | Identical except the stamped version (expected) |
| Installed vs repo `manifest.json` | Identical |
| `src/ui.html` vs `dist/index.html` | Identical |
| Commands in `src/code.ts` vs `dist/code.js` | Same 10 commands (no drift) |

## 6. Findings

| # | Severity | Where | Finding |
|---|---|---|---|
| 1 | warning | `FigmaBridge.cs:216-219, 247-266` | **No authentication or Origin check on the WebSocket upgrade.** Any client with a `Sec-WebSocket-Key` becomes the plugin ("latest connection wins"). A local program can displace the real plugin, then return fake design data (which Claude would trust) or swallow commands. It cannot read the Figma file itself. |
| 2 | warning | `FigmaBridge.cs:233-237, 378-414` | **`/rpc` is unauthenticated and has no Host header check.** Any local program can run read commands against the open file and receive exports. Without a Host check, a DNS-rebinding web page may also reach it. Loopback binding limits exposure, but browsers do not apply same-origin rules to WebSocket opens or rebinding. **Not tested live** against this machine's Chrome. |
| 3 | warning | `FigmaBridge.cs:266` | **Plugin open in two Figma files = silent switching.** The newest connection wins with no warning, and the old socket stays open. Reads can go to a different file than expected. Workaround: keep the plugin open in one file only and check `figma_status` shows the right file name. |
| 4 | info | `FigmaBridge.cs:267, 336-339` | `_pluginVersion` is reset on connect and set only when `hello` arrives. A `figma_status` in that short window shows a false "stale plugin" warning. |
| 5 | info | `FigmaBridge.cs:284-316` | WebSocket messages build up in an unbounded `MemoryStream`. `/rpc` bodies are capped at 32 MB (line 610); the plugin path has no cap. |
| 6 | info | `FigmaBridge.cs:405` | `/rpc` accepts any client-supplied `timeoutMs` with no upper bound. |
| 7 | info | `FigmaBridge.cs:399-401` | Comment says the plugin serves one command at a time, but `code.ts:13` uses an async handler, so commands can overlap. The code is still correct; the comment is misleading. |
| 8 | info | `FigmaBridge.cs:495-510` | A slow but alive leader (reply longer than timeout + 5 s) looks dead to a follower. It tries to re-elect, fails, and reports "leader is unreachable", which is misleading. |
| 9 | info | `FigmaBridge.cs:44-48` | `_pluginSocket`, `_pluginVersion`, `_isLeader` are shared across threads without `volatile` or locks. Benign in practice. |
| 10 | info | `FigmaTools.cs:194, 209` | `figma_save_screenshot` / `figma_save_image` write any path, overwrite silently, and throw if the folder does not exist. |
| 11 | info | `FigmaColorHex.cs:41-50` | `hex` drops alpha, so a 50% transparent colour shows as solid (raw `a` is still present). Any object with r/g/b all in 0-1 gets a hex, even if it is not a colour; the only negative test uses out-of-range values. |
| 12 | info | `FigmaPluginInstaller.cs:63-66` | Plugin files are written non-atomically. Several sessions starting at once could write the same file while Figma reads it. |
| 13 | info | `figma-plugin/package.json`, `README.md` | Package version is still `0.2.0` and the README mentions "plugin 0.2.0", while the real build is stamped 0.3.21. |
| 14 | info | `Documentation/handoffs/2026-07-14T06-27-25Z_claude-config-figma-mcp.md` | Stale handoff marked `status: active` says no Webority Figma MCP exists. Outdated since 15-Aug-2026. |
| 16 | warning | `FigmaTools.cs:175-178` | **`figma_get_screenshot` (PNG/JPG) is broken with this Claude Code build.** Verified live 15-Sep-2026 on node 1332:17937: Claude Code rejected the result with "Invalid Base64 string" at `content[0].data`. Likely cause (unconfirmed): `ImageContentBlock.Data` is given decoded bytes where the MCP SDK expects base64 text. Workaround: `figma_save_screenshot` to a file, which works. |
| 15 | info | tests | Not covered: `FigmaTools` validation, the stale-plugin warning branch, `hello` parsing, two plugins connecting, and all of `code.ts` (typecheck only, no runtime tests). The 5 s send-cap path is deliberately untested (reason given in the test file). |

## 7. Data gaps (designer impact)

`serializeNode` at the bottom of `figma-plugin/src/code.ts` does not return:

- **Sizing**: `layoutSizingHorizontal/Vertical` (Fill / Hug / Fixed), min/max width/height, constraints, `layoutWrap`, `layoutPositioning`
- **Components**: `componentProperties`, `variantProperties`, `mainComponent` id, overrides
- **Text**: `lineHeight`, `letterSpacing`, `textCase`, `textAlignVertical`. Mixed-style text drops `fontSize` / `fontName` entirely (no `getStyledTextSegments`)
- **Tokens**: layer-level `boundVariables` (padding, gap, radius, size), `fillStyleId`, `textStyleId`, `effectStyleId`. Paint colour variables ARE returned as `VariableID:...` inside each fill/stroke (verified live 15-Sep-2026), but only as IDs: local ones can be matched via `figma_get_variable_defs`, library ones cannot
- **Shape**: per-corner radii when mixed, rotation, blend mode, `clipsContent`, masks
- **Other**: prototype reactions, team library styles and variables (local only), selection on other pages

## 8. Recommendations

**Security (findings 1-2):**
1. On WebSocket upgrade, accept only `Origin: null` (Figma plugin iframes) and reject anything else.
2. On every request, require `Host` to be `localhost:3691`, `127.0.0.1:3691` or `[::1]:3691`.
3. Add a per-machine token (for example `~/.webority/figma-bridge.token`): stamp it into `index.html` the same way as the version, and require it in `hello` and on `/rpc`.

**Reliability:**
4. When a second plugin connects, close the old socket and log which file took over, or refuse the newcomer and report both in `figma_status`.
5. Cap WebSocket message size and `timeoutMs`; create parent folders in the save tools.
6. Write plugin files atomically (temp file, then move).

**Data (section 7):** extend `serializeNode` with the missing fields. Per the plugin README, run `npm run build` and commit `dist/` with the change, because the CLI embeds the committed `dist/`.

**Housekeeping:** bump or remove the `package.json` version, update the README version note, close the stale 14-Jul handoff.
