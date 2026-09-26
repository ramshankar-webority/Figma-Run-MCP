// Figma REST API reader, for people who cannot run the plugin.
//
// A free or view-only seat can read any file it can open, using that person's own personal access
// token, but Figma's budget for those seats is tiny: roughly 20 file or image requests A MONTH
// (Dev and Full seats get 10 to 20 a minute). So every response is cached on disk and reused until
// the file's version changes, and the tools report how many calls this machine has spent.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { normId } from "./util.js";
import { tokenPath } from "./token.js";

const API = "https://api.figma.com/v1";

// Where a personal access token is kept, in order: the environment, the user's own profile, then a
// repo's .figma/token. The repo copy is only used when git ignores it: the docs tell people to commit
// .figma/ for snapshots, and a committed personal token is readable by everyone with the repo.
export function userTokenFile(env = process.env) {
  return path.join(path.dirname(tokenPath(env)), "figma-token");
}

function gitIgnores(repoDir, rel) {
  try {
    execFileSync("git", ["-C", repoDir, "check-ignore", "-q", rel], { stdio: "ignore", windowsHide: true });
    return true; // exit 0: ignored
  } catch {
    return false; // exit 1: not ignored; other codes: not a repo or no git, so treat as unsafe
  }
}

export function tokenFrom(env = process.env, repoDir) {
  if (env.FIGMA_TOKEN) return { token: env.FIGMA_TOKEN.trim(), source: "FIGMA_TOKEN" };
  if (env.FIGMA_PERSONAL_ACCESS_TOKEN) return { token: env.FIGMA_PERSONAL_ACCESS_TOKEN.trim(), source: "FIGMA_PERSONAL_ACCESS_TOKEN" };
  for (const file of [userTokenFile(env), path.join(os.homedir(), ".figma", "token")]) {
    if (fs.existsSync(file)) return { token: fs.readFileSync(file, "utf8").trim(), source: file };
  }
  if (repoDir) {
    const file = path.join(repoDir, ".figma", "token");
    if (fs.existsSync(file)) {
      if (gitIgnores(repoDir, ".figma/token")) return { token: fs.readFileSync(file, "utf8").trim(), source: file };
      return { token: null, source: null, warning: `Found ${file} but did not use it: git does not ignore it, so it could be committed. Move it to ${userTokenFile(env)}, or add .figma/token to .gitignore.` };
    }
  }
  return { token: null, source: null };
}

// A Figma URL carries the key: figma.com/design/<key>/<name>?node-id=1-2
export function parseFileRef(ref) {
  const m = String(ref).match(/figma\.com\/(?:file|design|proto)\/([A-Za-z0-9]+)/);
  const key = m ? m[1] : String(ref).trim();
  const node = String(ref).match(/node-id=([0-9]+[-:][0-9]+)/);
  return { key, nodeId: node ? normId(node[1]) : null };
}

export class FigmaRest {
  constructor({ token, cacheDir, log = () => {}, tokenWarning }) {
    this.token = token;
    this.tokenWarning = tokenWarning;
    this.cacheDir = cacheDir || path.join(os.homedir(), ".figma", "rest-cache");
    this.log = log;
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  #counterFile() {
    return path.join(this.cacheDir, "usage.json");
  }

  usage() {
    const file = this.#counterFile();
    if (!fs.existsSync(file)) return { month: new Date().toISOString().slice(0, 7), calls: 0, byEndpoint: {} };
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const month = new Date().toISOString().slice(0, 7);
    return data.month === month ? data : { month, calls: 0, byEndpoint: {} };
  }

  #count(endpoint) {
    const usage = this.usage();
    usage.calls += 1;
    usage.byEndpoint[endpoint] = (usage.byEndpoint[endpoint] || 0) + 1;
    fs.writeFileSync(this.#counterFile(), JSON.stringify(usage));
    return usage;
  }

  #cacheFile(key) {
    return path.join(this.cacheDir, key.replace(/[^A-Za-z0-9_.-]/g, "_") + ".json");
  }

  readCache(key, maxAgeMs) {
    const file = this.#cacheFile(key);
    if (!fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (maxAgeMs && Date.now() - stat.mtimeMs > maxAgeMs) return null;
    try {
      return { ...JSON.parse(fs.readFileSync(file, "utf8")), cachedAt: stat.mtime.toISOString() };
    } catch {
      return null;
    }
  }

  writeCache(key, value) {
    fs.writeFileSync(this.#cacheFile(key), JSON.stringify(value));
  }

  async get(endpoint, { cacheKey, maxAgeMs = 7 * 24 * 60 * 60 * 1000, refresh = false } = {}) {
    if (!this.token && this.tokenWarning) throw new Error(this.tokenWarning);
    if (!this.token) throw new Error("No Figma token. Set FIGMA_TOKEN, or save it in " + userTokenFile() + " (Figma: Settings, Security, personal access tokens). Never commit it.");
    const key = cacheKey || endpoint;
    if (!refresh) {
      const hit = this.readCache(key, maxAgeMs);
      if (hit) return { ...hit, fromCache: true };
    }
    const res = await fetch(API + endpoint, { headers: { "X-Figma-Token": this.token } });
    const usage = this.#count(endpoint.split("?")[0].split("/").slice(0, 3).join("/"));
    if (res.status === 429) {
      throw new Error(
        `Figma rate limit reached (429). View and Collab seats get roughly 20 file or image requests per month. Calls counted this month on this machine: ${usage.calls}. The cached copy is still readable with refresh set to false.`
      );
    }
    if (res.status === 403 || res.status === 404) {
      throw new Error(`Figma refused this file (${res.status}). Check the token is yours, and that your account can open the file.`);
    }
    if (!res.ok) throw new Error(`Figma REST ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const wrapped = { data, fetchedAt: new Date().toISOString(), calls: usage.calls };
    this.writeCache(key, wrapped);
    return { ...wrapped, fromCache: false };
  }
}
