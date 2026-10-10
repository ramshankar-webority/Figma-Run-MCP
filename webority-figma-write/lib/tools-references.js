// figma_place_references and prompt design_with_references: put real-product references (Mobbin results,
// or any image URL or file) on a board next to the frame being designed. Rules text: REFERENCE_RULES in lib/references.js.

import { z } from "zod";
import { boardScript, loadReferenceImage, REFERENCE_MAX_TOTAL } from "./references.js";
import { normId } from "./util.js";

export function registerReferenceTools({ server, bridge, text, fail }) {
  server.registerTool(
    "figma_place_references",
    {
      description:
        "Place design references on a board in the open Figma file, next to the frame being designed (nextTo, else the selection). Each reference is an https image URL (a Mobbin result's image_url, which needs image_format jpg) or a local file, captioned with its title linked to sourceUrl (the mobbin_url) and a note on what to take from it. Use before designing a new screen, flow or section; see the Design references rules. PNG, JPG or GIF only. Needs 'Allow edits'. One undo step.",
      inputSchema: {
        references: z
          .array(
            z
              .object({
                imageUrl: z.string().url().optional().describe("https image URL, e.g. a Mobbin result's image_url."),
                path: z.string().optional().describe("Local image file instead of a URL."),
                title: z.string().max(120).optional().describe("Caption, e.g. the Mobbin app_name."),
                sourceUrl: z.string().url().optional().describe("Link for the caption, e.g. the Mobbin mobbin_url."),
                note: z.string().max(300).optional().describe("What to take from this reference, one line."),
              })
              .refine((r) => r.imageUrl || r.path, { message: "Each reference needs imageUrl or path." })
          )
          .min(1)
          .max(12),
        nextTo: z.string().optional().describe("Node the board goes to the right of. Default: the selection, else the viewport centre."),
        boardName: z.string().max(120).optional().describe("Default 'References'. Name it by topic, e.g. 'References: login'."),
        cardWidth: z.number().int().min(120).max(1200).optional().describe("Card width in px. Default 320 (fits phone screens; use 640 for web)."),
        columns: z.number().int().min(1).max(12).optional().describe("Cards per row. Default 6."),
      },
      annotations: { destructiveHint: true, readOnlyHint: false, openWorldHint: true },
    },
    async ({ references, nextTo, boardName, cardWidth, columns }) => {
      try {
        const loaded = await Promise.allSettled(references.map((r) => loadReferenceImage(r)));
        const cards = [];
        const skipped = [];
        let total = 0;
        loaded.forEach((res, i) => {
          const r = references[i];
          if (res.status === "rejected") return skipped.push({ reference: r.title || r.imageUrl || r.path, reason: res.reason.message });
          total += res.value.bytes.length;
          if (total > REFERENCE_MAX_TOTAL) return skipped.push({ reference: r.title || r.imageUrl || r.path, reason: "Board over 30 MB; place the rest in a second call." });
          cards.push({ b64: res.value.bytes.toString("base64"), title: r.title, sourceUrl: r.sourceUrl, note: r.note });
        });
        if (!cards.length) throw new Error("No reference could be loaded: " + JSON.stringify(skipped));
        const code = boardScript({ cards, boardName: boardName || "References", nextTo: nextTo ? normId(nextTo) : null, cardWidth: cardWidth || 320, columns: columns || 6 });
        const result = await bridge.request("execute", { code, timeoutMs: 60000 }, 65000);
        return text({ ...result.result, fileName: result.fileName, placed: cards.length, skipped });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerPrompt(
    "design_with_references",
    {
      title: "Design with Mobbin references",
      description: "Search Mobbin for how real products solve it, put the best references on a board in Figma, then design from them.",
      argsSchema: {
        brief: z.string().describe("What to design, e.g. 'login screen for a fintech app with email and Google sign-in'."),
        platform: z.string().optional().describe("ios or web. Default: from the brief, else ios."),
        nodeId: z.string().optional().describe("Frame to design in or next to; default the selection."),
      },
    },
    ({ brief, platform, nodeId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Design this in the open Figma file: ${brief}
Platform: ${platform || "decide from the brief, else ios"}. Target: ${nodeId || "the current selection"}.

1. figma_write_status: the plugin must be connected with Allow edits on.
2. Break the brief into its screens or sections. For each, search Mobbin (search_screens, or search_flows for a journey, search_sections for a website section) with image_format "jpg" and output_destination "design_tool". No Mobbin tools: say so and skip to step 5.
3. Look at the returned images and keep the 3 to 6 strongest, varied references. Say in one line each what pattern it shows.
4. figma_place_references with imageUrl = image_url, sourceUrl = mobbin_url, title = app_name, a note per reference, nextTo = the target, boardName "References: <topic>".
5. Design it (figma_create_from_spec or figma_execute), taking structure, hierarchy and component choices from the references, never copying a screen. Use the Webority colour tokens and the file's styles.
6. Export the result, run design_review on it, fix what it finds, and summarise which reference informed which decision, with the Mobbin links.`,
          },
        },
      ],
    })
  );
}
