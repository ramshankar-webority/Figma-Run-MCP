// The bridge token: a per-user secret that lets the plugin and the server prove who they are.
//
// It lives in the user's own profile (%LOCALAPPDATA% on Windows, ~/.config elsewhere), not in the install
// folder, because an install folder such as C:\Dev is often readable and writable by every account on the
// machine. On Windows, node's file mode is ignored, so the file and the generated plugin UI (which also
// holds the token) get an explicit owner-only ACL. FIGMA_WRITE_TOKEN_FILE overrides the path (tests use it).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export function tokenPath(env = process.env) {
  if (env.FIGMA_WRITE_TOKEN_FILE) return env.FIGMA_WRITE_TOKEN_FILE;
  const base = process.platform === "win32"
    ? env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
    : env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "webority-figma-mcp", "bridge-token");
}

// Owner-only access. Best effort: a failure is logged, never fatal.
export function restrictToOwner(file, log = () => {}) {
  try {
    if (process.platform === "win32") {
      const user = process.env.USERDOMAIN && process.env.USERNAME ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : process.env.USERNAME;
      if (!user) return;
      execFileSync("icacls", [file, "/inheritance:r", "/grant:r", `${user}:F`], { stdio: "ignore", windowsHide: true });
    } else fs.chmodSync(file, 0o600);
  } catch (e) {
    log(`[token] could not restrict access to ${file}: ${e.message}`);
  }
}

// Returns the token, creating it on first use. A token left in the old place (<install>/.bridge-token)
// is moved, so an open plugin keeps working, and the old copy is deleted.
export function ensureToken({ legacyDir, log = () => {}, file } = {}) {
  // A path overridden through the environment (the test server) never adopts the real legacy token.
  const adoptLegacy = Boolean(legacyDir) && (Boolean(file) || !process.env.FIGMA_WRITE_TOKEN_FILE);
  file = file || tokenPath();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const legacy = adoptLegacy ? path.join(legacyDir, ".bridge-token") : null;
    const value = legacy && fs.existsSync(legacy) ? fs.readFileSync(legacy, "utf8").trim() : crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(file, value, { mode: 0o600 });
    restrictToOwner(file, log);
    if (legacy && fs.existsSync(legacy)) {
      try {
        fs.unlinkSync(legacy);
        log(`[token] moved ${legacy} to ${file}`);
      } catch (e) {
        log(`[token] moved the token to ${file}, but could not delete ${legacy}: ${e.message}`);
      }
    }
  }
  return fs.readFileSync(file, "utf8").trim();
}
