// Stitches PNG frames into MP4 / WebM / GIF with the bundled ffmpeg (ffmpeg-static).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { pngSize } from "./png.js";

export const VIDEO_FORMATS = ["mp4", "webm", "gif"];

export function makeFrameDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "webority-figma-video-"));
}

export function writeFrame(dir, index, base64) {
  const bytes = Buffer.from(base64, "base64");
  fs.writeFileSync(path.join(dir, `frame_${String(index).padStart(5, "0")}.png`), bytes);
  return pngSize(bytes);
}

const even = (n) => Math.max(2, Math.floor(n / 2) * 2);

// frameRate: input frames per second (1/holdSeconds for slideshows). fps: output rate.
export function encodeVideo({ dir, frameCount, width, height, format, frameRate, fps, loop = true, savePath }) {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return Promise.reject(new Error("ffmpeg binary missing. Run npm install in webority-figma-write."));
  const W = format === "gif" ? width : even(width);
  const H = format === "gif" ? height : even(height);
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`;
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(frameRate), "-i", path.join(dir, "frame_%05d.png")];
  if (format === "gif") {
    args.push("-filter_complex", `[0:v]fps=${fps},${fit}:color=white,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`, "-loop", loop ? "0" : "-1");
  } else if (format === "webm") {
    args.push("-vf", `${fit}:color=black,format=yuv420p`, "-r", String(fps), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1");
  } else {
    args.push("-vf", `${fit}:color=black,format=yuv420p`, "-r", String(fps), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart");
  }
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  args.push(savePath);
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) return reject(new Error("ffmpeg failed: " + (String(stderr).trim() || err.message)));
      const bytes = fs.statSync(savePath).size;
      resolve({ saved: savePath, format, frames: frameCount, width: W, height: H, fps, durationSeconds: Math.round((frameCount / frameRate) * 100) / 100, bytes });
    });
  });
}
