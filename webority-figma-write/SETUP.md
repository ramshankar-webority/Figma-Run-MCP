# Webority Figma MCP: setup on a new machine

Lets Claude read and write the Figma file open in your Figma desktop app, map components to code, and answer design questions even when you have no Figma seat. Everything runs on your own PC.

**You need:** Node 20 or newer, Claude Code, and the Figma desktop app. Your Claude plan and account do not matter; what matters is your access to the Figma file.

## 1. Install

```bash
cd <where-you-unzipped>/webority-figma-write
npm install
```

## 2. Register it with Claude Code

Use the full path to `server.js` on your machine:

```bash
claude mcp add -s user Figma-MCP-Webority -- node "C:/path/to/webority-figma-write/server.js"
```

`-s user` registers it for every project on your machine. Restart Claude Code so the tools load, then check with `/mcp`: you should see **Figma-MCP-Webority** connected with 52 tools. Updating from an older version: replace the folder, run `npm install`, restart Claude Code, then close and reopen the plugin in Figma.

## 3. Import the Figma plugin (once)

Figma desktop, open any design file, right-click the canvas, **Plugins > Development > Import plugin from manifest**, and choose:

```
<where-you-unzipped>/webority-figma-write/plugin/manifest.json
```

## 4. Use it

1. Open your file in the **design editor** (not Dev Mode; press Shift + D to leave it).
2. Right-click the canvas, **Plugins > Development > Webority Figma MCP**. Keep the panel open.
3. Tick **Allow edits** only when you want Claude to change the file. It resets every time the plugin opens.
4. Ask Claude, for example "read the selected frame", "what fonts does this page use", or "build a pricing card here".

The panel shows grey "Waiting for Claude..." until Claude makes its first Figma call. That is normal.

## What works with which Figma access

| Your access | What you get |
|---|---|
| Can edit the file | Everything: reads, writes, Code Connect, shaders, generative plugins, video export, image generation |
| Can view only, or no seat | The read tools and Code Connect still work from a **design snapshot**. Ask a teammate with access to run `figma_save_snapshot` with `savePath: <your-repo>/.figma/design-snapshot.json`, and commit that folder (never with a personal access token in it). Then call the read tools normally: they find it automatically |

Run **`figma_access_check`** any time and it tells you exactly what your machine can do and what to do next.

## First checks

```bash
npm test          # 22 automated checks, no Figma needed
```

In Claude: `figma_write_status` reports whether the plugin is connected, which file it has open, and whether edits are allowed.

## Notes

- **Image generation (optional):** `figma_generate_image` works with no setup. Images carry a small logo until you save a free token from auth.pollinations.ai as one line in `%LOCALAPPDATA%\webority-figma-mcp\image-gen-token`.
- **Nothing leaves your PC except image prompts.** `figma_generate_image` sends its prompt to pollinations.ai; everything else stays local. The bridge listens on `127.0.0.1` only (first free port of 3692-3699), checks the Host and Origin headers, and both sides prove they know a per-user token without ever sending it.
- **The bridge token is a secret.** It is created on first run in `%LOCALAPPDATA%webority-figma-mcpridge-token`, readable only by you. It is not in this package and must not be shared. `plugin/ui.html` is generated from it and is locked to you too.
- **REST token:** set `FIGMA_TOKEN`, or save it in `%LOCALAPPDATA%webority-figma-mcpigma-token`. A repo's `.figma/token` is used only when git ignores it.
- **Port already in use** means another Claude session on your machine is using the plugin. Use that session, or close it.
- **"Edits are off"** means the Allow edits tick box is not ticked in the plugin panel.
- **Dev Mode is read-only.** Writes are refused there by design.

Full tool list and details: `README.md` in this folder.
