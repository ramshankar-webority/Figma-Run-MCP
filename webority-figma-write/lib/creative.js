// Creative tab: an isolated browser for running ChatGPT or Gemini by hand, and an inbox folder
// that collects what the person downloads or pastes, so it can be placed in the Figma file.
// The browser is a normal Chrome or Edge window with its own profile. No automation flags: Google
// refuses sign-in in a browser started with remote debugging, and generation stays manual.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn as nodeSpawn } from "node:child_process";

export const CREATIVE_SITES = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app" },
};

// Social media sizes for a new layer. "original" keeps the file's own size (long side at most 1024).
export const SOCIAL_SIZES = {
  original: { label: "Original size" },
  "ig-square": { label: "Instagram post 1:1", width: 1080, height: 1080 },
  "ig-portrait": { label: "Instagram portrait 4:5", width: 1080, height: 1350 },
  story: { label: "Story / Reel 9:16", width: 1080, height: 1920 },
  "linkedin-post": { label: "LinkedIn post 1.91:1", width: 1200, height: 627 },
  "x-post": { label: "X post 16:9", width: 1600, height: 900 },
  "youtube-thumb": { label: "YouTube thumbnail", width: 1280, height: 720 },
  "fb-cover": { label: "Facebook cover", width: 1640, height: 624 },
};

// 40 MB raw is about 54 MB as base64, under the bridge's 64 MB message limit.
export const CREATIVE_MAX_BYTES = 40 * 1024 * 1024;
const KINDS = { png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image", mp4: "video", webm: "video", mov: "video" };
const PARTIAL = /\.(crdownload|tmp|part|download)$/i;

const localAppData = (env) => (process.platform === "win32" ? env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local") : env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"));

export function creativePaths(env = process.env) {
  return {
    inbox: env.FIGMA_CREATIVE_DIR || path.join(os.homedir(), "Pictures", "Webority Creative"),
    profile: env.FIGMA_CREATIVE_PROFILE || path.join(localAppData(env), "webority-figma-mcp", "creative-browser"),
  };
}

export function findBrowser(env = process.env, exists = fs.existsSync) {
  if (env.FIGMA_CREATIVE_BROWSER) {
    if (!exists(env.FIGMA_CREATIVE_BROWSER)) throw new Error(`FIGMA_CREATIVE_BROWSER points at a missing file: ${env.FIGMA_CREATIVE_BROWSER}`);
    return env.FIGMA_CREATIVE_BROWSER;
  }
  const pf = env.ProgramFiles || "C:\\Program Files";
  const pf86 = env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const candidates = process.platform === "win32"
    ? [
        path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(localAppData(env), "Google", "Chrome", "Application", "chrome.exe"),
        path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
      ]
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"];
  const hit = candidates.find((c) => exists(c));
  if (!hit) throw new Error(`No Chrome or Edge found. Looked in: ${candidates.join("; ")}. Set FIGMA_CREATIVE_BROWSER to a Chromium browser.`);
  return hit;
}

export function browserArgs(profile, url) {
  return [`--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--new-window", url];
}

// A new profile gets the inbox as its download folder, with no save prompt. An existing profile is left
// alone: Chromium rewrites Preferences on exit, so the person's own later changes win.
function seedProfile(profile, inbox) {
  const prefs = path.join(profile, "Default", "Preferences");
  if (fs.existsSync(prefs)) return false;
  fs.mkdirSync(path.dirname(prefs), { recursive: true });
  fs.writeFileSync(prefs, JSON.stringify({ download: { default_directory: inbox, prompt_for_download: false, directory_upgrade: true }, savefile: { default_directory: inbox } }));
  return true;
}

export function openCreativeBrowser(site, { env = process.env, spawn = nodeSpawn, exists = fs.existsSync } = {}) {
  const s = CREATIVE_SITES[site];
  if (!s) throw new Error(`Unknown site '${site}'. Use: ${Object.keys(CREATIVE_SITES).join(", ")}.`);
  const { inbox, profile } = creativePaths(env);
  fs.mkdirSync(inbox, { recursive: true });
  const browser = findBrowser(env, exists);
  const seeded = seedProfile(profile, inbox);
  const child = spawn(browser, browserArgs(profile, s.url), { detached: true, stdio: "ignore", windowsHide: false });
  child.on?.("error", () => {});
  child.unref?.();
  return { opened: s.label, url: s.url, browser: path.basename(browser), profile, inbox, newProfile: seeded };
}

export function kindOf(name) {
  return KINDS[path.extname(String(name)).slice(1).toLowerCase()] || null;
}

// Newest first. Partial downloads and other files are skipped.
export function listInbox({ env = process.env, limit = 20 } = {}) {
  const { inbox } = creativePaths(env);
  if (!fs.existsSync(inbox)) return { inbox, files: [] };
  const files = [];
  for (const name of fs.readdirSync(inbox)) {
    if (PARTIAL.test(name) || !kindOf(name)) continue;
    const st = fs.statSync(path.join(inbox, name));
    if (!st.isFile()) continue;
    files.push({ name, kind: kindOf(name), bytes: st.size, modified: st.mtime.toISOString() });
  }
  files.sort((a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : 0));
  return { inbox, files: files.slice(0, limit), total: files.length };
}

function inboxFile(inbox, name) {
  const n = String(name || "");
  if (!n || n !== path.basename(n) || n.includes("..") || /[\\/]/.test(n)) throw new Error(`Bad file name '${n}'. Use a name from the inbox list.`);
  const full = path.resolve(inbox, n);
  if (path.dirname(full) !== path.resolve(inbox)) throw new Error(`Bad file name '${n}'.`);
  return full;
}

export function readInboxFile(name, { env = process.env } = {}) {
  const { inbox } = creativePaths(env);
  const full = inboxFile(inbox, name);
  const kind = kindOf(name);
  if (!kind) throw new Error(`Not an image or video: ${name}`);
  if (!fs.existsSync(full)) throw new Error(`Not in the inbox: ${name}`);
  const size = fs.statSync(full).size;
  if (size > CREATIVE_MAX_BYTES) throw new Error(`${name} is ${Math.round(size / 1048576)} MB; the limit is 40 MB.`);
  return { name, kind, bytes: fs.readFileSync(full) };
}

// File type from its first bytes, so a pasted or renamed file cannot pretend to be an image.
export function sniff(buf) {
  const b = buf.subarray(0, 16);
  const ascii = (i, s) => b.toString("latin1", i, i + s.length) === s;
  if (b[0] === 0x89 && ascii(1, "PNG")) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (ascii(0, "GIF8")) return "gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";
  if (ascii(4, "ftyp")) return ascii(8, "qt") ? "mov" : "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

// Saves a pasted or dropped file into the inbox under a safe, unique name.
export function saveInboxFile(name, bytes, { env = process.env } = {}) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error("Empty file.");
  if (bytes.length > CREATIVE_MAX_BYTES) throw new Error("File is over the 40 MB limit.");
  const ext = sniff(bytes);
  if (!ext) throw new Error("Not a PNG, JPG, WEBP, GIF, MP4, WEBM or MOV file.");
  const { inbox } = creativePaths(env);
  fs.mkdirSync(inbox, { recursive: true });
  const stem = path.basename(String(name || "pasted"), path.extname(String(name || ""))).replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "pasted";
  let file = `${stem}.${ext}`;
  for (let i = 2; fs.existsSync(path.join(inbox, file)); i++) file = `${stem}-${i}.${ext}`;
  fs.writeFileSync(path.join(inbox, file), bytes);
  return { name: file, kind: kindOf(file), bytes: bytes.length };
}

export function openInboxFolder({ env = process.env, spawn = nodeSpawn } = {}) {
  const { inbox } = creativePaths(env);
  fs.mkdirSync(inbox, { recursive: true });
  const cmd = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(cmd, [inbox], { detached: true, stdio: "ignore" });
  child.on?.("error", () => {});
  child.unref?.();
  return { opened: inbox };
}

// Requests from the plugin panel (the person's own clicks), answered over the bridge.
export function handlePanelRequest(action, params = {}, opts = {}) {
  switch (action) {
    case "creative_open":
      return openCreativeBrowser(params.site, opts);
    case "creative_list":
      return { ...listInbox(opts), sites: CREATIVE_SITES, sizes: SOCIAL_SIZES };
    case "creative_file": {
      const f = readInboxFile(params.name, opts);
      return { name: f.name, kind: f.kind, base64: f.bytes.toString("base64") };
    }
    case "creative_save":
      return saveInboxFile(params.name, Buffer.from(String(params.base64 || ""), "base64"), opts);
    case "creative_folder":
      return openInboxFolder(opts);
    default:
      throw new Error(`Unknown panel request '${action}'.`);
  }
}

export const CREATIVE_RULES = `Creative tab (webority-figma-write)
The plugin panel has a Creative tab where the person runs ChatGPT or Gemini by hand in an isolated browser window (its own profile) to make images and videos, mostly for social media creatives. Downloads and pasted images land in the Creative inbox folder.
- You never open that browser and never automate those sites; the person does the generation. You may suggest a prompt for them to paste.
- When they say they made something ("use the image I just made", "put the Gemini video in the post"), call figma_creative_inbox, confirm which file when more than one fits, then figma_creative_place: nodeIds fills existing layers; otherwise a new layer is made, and size picks a social format (ig-square 1080x1080, ig-portrait 1080x1350, story 1080x1920, linkedin-post 1200x627, x-post 1600x900, youtube-thumb 1280x720, fb-cover 1640x624).
- Build social layouts with the default colour tokens and check the result with figma_export before reporting done.`;
