// Design harness: design_review (scored, persona-owned hard checks, Laya for bulk tappability),
// design_personas, and the persona prompts (persona_<id>, design_panel).

import { z } from "zod";
import { reviewTree, ambiguousTargets, CATEGORIES } from "./design-review.js";
import { PERSONAS, personaPrompt, panelPrompt } from "./design-personas.js";
import { layaUrl, layaPredict } from "./laya.js";
import { loadSnapshot, findById, defaultSnapshotPath } from "./snapshot.js";

export async function layaTappable(root, url = layaUrl()) {
  if (!url) return { tappable: new Set(), laya: { used: false } };
  const cands = ambiguousTargets(root);
  const tappable = new Set();
  // A choice separates better than yes/no: Laya's yes/no leans towards yes on any rounded, filled box.
  const q = { role: { type: "choice", instructions: "What is this mobile UI layer?", criteria: { control: "a button, chip, tab, toggle, link or key the user taps", status: "a label, badge, tag or status pill that only shows information", group: "a layout group holding text or icons", decoration: "an illustration, background shape or legend swatch" } } };
  // The first call may wait for the model to warm up; later calls are quick. One failed call skips that
  // layer; three in a row mean Laya is down, so the review continues on name rules alone.
  let asked = 0, failed = 0, streak = 0, lastError;
  for (const c of cands) {
    try {
      const r = await layaPredict(c.state, q, url, asked === 0 ? 120000 : 30000, "english");
      asked++; streak = 0;
      const a = r.answers?.role;
      if (a && a.choice === "control" && (a.probabilities?.control ?? 0) >= 0.5) tappable.add(c.id);
    } catch (e) {
      failed++; streak++; lastError = e.message;
      if (streak >= 3) break;
    }
  }
  const laya = { used: true, candidates: cands.length, asked, tappable: tappable.size };
  if (failed) Object.assign(laya, { failed, error: lastError, hint: streak >= 3 ? "Laya stopped answering: the rest used name rules only." : "Some layers were skipped." });
  return { tappable, laya };
}

export function registerDesignTools({ server, bridge, text, fail }) {
  server.registerTool(
    "design_review",
    {
      description:
        "Score a Figma frame, section or screen set like a senior design team: accessibility (WCAG contrast, 44 px targets, 12 px minimum text), visual (overflow, type scale, font families), hierarchy (one primary action per screen), content (placeholder copy, all caps) and design system (spacing grid, colour count). Every finding has a layer id, the persona who owns it and a fix. Uses Laya, when on, to decide which ambiguous layers are tappable. Reads live through the plugin, or from a snapshot when no plugin is connected. Follow up with the persona prompts or design_personas for the judgement the checks cannot make.",
      inputSchema: {
        nodeId: z.string().min(1).describe("Frame, section or page node to review, e.g. '2011:2'."),
        snapshot: z.string().optional().describe("Absolute path to a design snapshot; used when given or when no plugin is connected."),
        grid: z.number().int().min(0).max(16).optional().describe("Spacing grid in px (default 4, 0 turns the check off)."),
        minText: z.number().min(8).max(20).optional().describe("Minimum text size in px (default 12)."),
        minTarget: z.number().min(24).max(64).optional().describe("Minimum touch target in px (default 44)."),
        useLaya: z.boolean().optional().describe("Default true: ask Laya about ambiguous layers when FIGMA_WRITE_LAYA_URL is set."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ nodeId, snapshot, grid = 4, minText = 12, minTarget = 44, useLaya = true }) => {
      try {
        let root, source;
        const snapPath = snapshot || (!bridge.status().connected ? defaultSnapshotPath() : null);
        if (snapPath) {
          const found = findById(loadSnapshot(snapPath), nodeId.replace("-", ":")).node;
          if (!found) throw new Error(`Node ${nodeId} is not in the snapshot ${snapPath}.`);
          root = found; source = "snapshot";
        } else {
          root = (await bridge.request("get_node", { nodeId: nodeId.replace("-", ":"), depth: 20, maxNodes: 5000 }, 120000)).node;
          source = "live";
        }
        const { tappable, laya } = useLaya ? await layaTappable(root) : { tappable: new Set(), laya: { used: false } };
        const report = reviewTree(root, { grid, minText, minTarget, tappable });
        const owners = [...new Set(report.findings.map((f) => f.persona))];
        return text({
          target: { id: root.id, name: root.name, type: root.type },
          source,
          laya,
          ...report,
          personas: PERSONAS.filter((p) => owners.includes(p.id) || ["strategist", "critic"].includes(p.id)).map((p) => ({ id: p.id, name: p.name, lens: p.lens })),
          next: "Export the screens and critique them through the persona lenses (prompt design_panel, or persona_<id>). Hard checks cover rules, not meaning.",
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "design_personas",
    {
      description: "The design team personas used by design_review and the persona prompts: lens, standing questions, the review rules each owns, and where each uses Laya. Use it when your client cannot run MCP prompts.",
      inputSchema: { id: z.enum(PERSONAS.map((p) => p.id)).optional().describe("One persona; omit for all.") },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => text({ categories: CATEGORIES, personas: id ? PERSONAS.filter((p) => p.id === id) : PERSONAS })
  );

  const args = {
    nodeId: z.string().optional().describe("Figma node to review; defaults to the selection."),
    brief: z.string().optional().describe("Product brief or goal, one or two sentences."),
  };
  for (const p of PERSONAS) {
    server.registerPrompt(`persona_${p.id}`, { title: p.name, description: `Review as the ${p.name}: ${p.lens}`, argsSchema: args }, ({ nodeId, brief }) => ({
      messages: [{ role: "user", content: { type: "text", text: personaPrompt(p, { nodeId, brief }) } }],
    }));
  }
  server.registerPrompt("design_panel", { title: "Design panel review", description: "All eight personas review the target, then the Design Critic ranks the top 5 changes.", argsSchema: args }, ({ nodeId, brief }) => ({
    messages: [{ role: "user", content: { type: "text", text: panelPrompt({ nodeId, brief }) } }],
  }));
}
