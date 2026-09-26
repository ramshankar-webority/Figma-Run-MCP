// figma_generate_image: generate an image from a prompt (lib/image-gen.js) and place it in the open file,
// as the fill of existing layers or as a new rectangle.

import fs from "node:fs";
import { z } from "zod";
import { generateImage, IMAGE_GEN_MAX } from "./image-gen.js";
import { normId, prepareSavePath } from "./util.js";

export function registerImageTools({ server, bridge, text, fail }) {
  server.registerTool(
    "figma_generate_image",
    {
      description:
        "Generate an image from a text prompt and put it in the open Figma file. With nodeIds it becomes the image fill of those layers (frames, rectangles, ellipses); without, a new rectangle is created (inside parentId, else next to the selection or at the viewport centre) and selected. The prompt is sent to the image generator, by default pollinations.ai (free, no key, cloud; FIGMA_IMAGE_GEN_URL changes it). The prompt and seed are stored on the layer, so the same seed gives the same image again. Returns the generated image. Needs 'Allow edits'. One undo step.",
      inputSchema: {
        prompt: z.string().min(1).max(2000).describe("What to draw, e.g. 'soft studio photo of a ceramic mug on a pastel background'."),
        nodeIds: z.array(z.string().min(1)).max(200).optional().describe("Layers to fill with the image. Omit to create a new rectangle."),
        width: z.number().int().min(64).max(IMAGE_GEN_MAX).optional().describe("Pixels. Default: the first target layer's width (x2 for sharpness, capped), else 1024."),
        height: z.number().int().min(64).max(IMAGE_GEN_MAX).optional().describe("Pixels. Default: matches the target layer's aspect, else 1024."),
        seed: z.number().int().min(0).optional().describe("Same prompt + seed gives the same image. Default: random, returned in the result."),
        model: z.string().optional().describe("Provider model, e.g. 'flux' (default on Pollinations) or 'turbo'."),
        parentId: z.string().optional().describe("Frame or section to create the new rectangle in (when nodeIds is omitted)."),
        name: z.string().optional().describe("Name for the new rectangle. Default: from the prompt."),
        fill: z
          .object({
            scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional(),
            opacity: z.number().min(0).max(1).optional(),
            mode: z.enum(["replace", "add"]).optional().describe("Replace the layer's fills (default) or add on top."),
          })
          .optional(),
        savePath: z.string().optional().describe("Absolute path to also save the image file to."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false, openWorldHint: true },
    },
    async ({ prompt, nodeIds, width, height, seed, model, parentId, name, fill, savePath }) => {
      try {
        prepareSavePath(savePath);
        const ids = (nodeIds || []).map(normId);
        // Fail fast, before the slow generation, when Figma cannot take the result.
        const target = await bridge.request("place_image", { dryRun: true, nodeIds: ids, parentId: parentId ? normId(parentId) : undefined }, 15000);
        let w = width, h = height;
        if (!w && !h && target.size) {
          const scale = Math.min(2, IMAGE_GEN_MAX / Math.max(target.size.width, target.size.height));
          w = Math.max(64, Math.round(target.size.width * scale));
          h = Math.max(64, Math.round(target.size.height * scale));
        } else if (w && !h && target.size) h = Math.max(64, Math.min(IMAGE_GEN_MAX, Math.round((w * target.size.height) / target.size.width)));
        else if (h && !w && target.size) w = Math.max(64, Math.min(IMAGE_GEN_MAX, Math.round((h * target.size.width) / target.size.height)));
        w = w || 1024;
        h = h || 1024;
        const useSeed = seed ?? Math.floor(Math.random() * 1e9);

        const img = await generateImage({ prompt, width: w, height: h, seed: useSeed, model });
        if (savePath) fs.writeFileSync(savePath, img.bytes);
        const meta = { prompt, seed: useSeed, model: img.model, provider: img.provider, withToken: img.token, width: img.width, height: img.height, generatedAt: new Date().toISOString() };
        const placed = await bridge.request(
          "place_image",
          { imageBase64: img.bytes.toString("base64"), nodeIds: ids, parentId: parentId ? normId(parentId) : undefined, name, fill: fill || {}, meta },
          60000
        );
        return {
          content: [
            { type: "image", data: img.bytes.toString("base64"), mimeType: img.mimeType },
            { type: "text", text: JSON.stringify({ ...placed, ...meta, bytes: img.bytes.length, mimeType: img.mimeType, saved: savePath || null }) },
          ],
        };
      } catch (e) {
        return fail(e);
      }
    }
  );
}
