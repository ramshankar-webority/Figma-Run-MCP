// Image generation for figma_generate_image. Default provider: Pollinations (free, no key), which runs in
// the cloud, so the prompt leaves this PC. FIGMA_IMAGE_GEN_URL points it at another server with the same
// GET /prompt/<text>?width&height&seed&model shape (tests use a local stub); FIGMA_IMAGE_GEN_TOKEN is sent
// as a Bearer token that removes the logo and raises the rate limit; without it the file
// %LOCALAPPDATA%\webority-figma-mcp\image-gen-token (next to the bridge token) is read.

import fs from "node:fs";
import path from "node:path";
import { tokenPath } from "./token.js";

export const IMAGE_GEN_DEFAULT_URL = "https://image.pollinations.ai";
export const IMAGE_GEN_MAX = 2048; // the provider's own ceiling; Figma allows 4096
const TIMEOUT_MS = 120000;

export const imageGenTokenFile = () => path.join(path.dirname(tokenPath(process.env)), "image-gen-token");

function imageGenToken() {
  if (process.env.FIGMA_IMAGE_GEN_TOKEN) return process.env.FIGMA_IMAGE_GEN_TOKEN.trim();
  try {
    return fs.readFileSync(imageGenTokenFile(), "utf8").trim() || null;
  } catch {
    return null;
  }
}

export const imageGenUrl = () => (process.env.FIGMA_IMAGE_GEN_URL || IMAGE_GEN_DEFAULT_URL).replace(/\/+$/, "");

// Figma takes PNG, JPEG or GIF. Returns null for anything else.
export function sniffImage(bytes) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mimeType: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mimeType: "image/gif", width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Walk the JPEG segments to the first start-of-frame marker, which carries the size.
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mimeType: "image/jpeg", width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
    return { mimeType: "image/jpeg", width: null, height: null };
  }
  return null;
}

async function fetchOnce(url, headers) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: ac.signal });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? `Image generation timed out after ${TIMEOUT_MS / 1000}s.` : `Could not reach the image generator (${imageGenUrl()}): ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImage({ prompt, width = 1024, height = 1024, seed, model }) {
  const base = imageGenUrl();
  const q = new URLSearchParams({ width: String(width), height: String(height), nologo: "true", private: "true" });
  if (seed != null) q.set("seed", String(seed));
  if (model) q.set("model", model);
  const url = `${base}/prompt/${encodeURIComponent(prompt)}?${q}`;
  const token = imageGenToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let res = await fetchOnce(url, headers);
  if (res.status >= 500 || res.status === 429) {
    await new Promise((r) => setTimeout(r, res.status === 429 ? 5000 : 1500));
    res = await fetchOnce(url, headers);
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Image generator answered ${res.status}${body ? ": " + body : ""}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const info = sniffImage(bytes);
  if (!info) throw new Error(`Image generator did not return an image (content-type ${res.headers.get("content-type") || "none"}).`);
  return { bytes, ...info, provider: base === IMAGE_GEN_DEFAULT_URL ? "pollinations" : base, token: !!token, seed: seed ?? null, model: model || null };
}
