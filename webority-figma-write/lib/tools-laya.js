// laya_status and laya_decide: direct access to the local Laya decision model, governed by LAYA_RULES.

import { z } from "zod";
import { LAYA_RULES, layaHealth, layaPredict } from "./laya.js";

const question = z.object({
  type: z.enum(["choice", "score", "noul"]).describe("choice = pick one option, score = ordinal rating, noul = yes/no probability."),
  instructions: z.string().min(1).describe("The question, for example 'What is this layer's role?'"),
  criteria: z
    .union([z.record(z.string(), z.string()), z.array(z.string())])
    .optional()
    .describe("Choice: options as { key: short description }, 2 to 11. Score: levels lowest first, as a list ['none', 'minor', 'severe'] or as { 0: '...', 1: '...' }."),
});

// laya-serve takes score levels only as a list, index 0 first, and rejects an object. Accept both
// forms here: numeric keys sort by value, other keys keep the order they were given in.
function toServerQuestions(questions) {
  const out = {};
  for (const [k, q] of Object.entries(questions)) {
    if (q.type === "score" && q.criteria && !Array.isArray(q.criteria)) {
      const keys = Object.keys(q.criteria);
      const numeric = keys.every((x) => x.trim() !== "" && !isNaN(Number(x)));
      if (numeric) keys.sort((a, b) => Number(a) - Number(b));
      out[k] = { ...q, criteria: keys.map((x) => q.criteria[x]) };
    } else out[k] = q;
  }
  return out;
}

export function registerLayaTools({ server, text, fail }) {
  server.registerTool(
    "laya_status",
    {
      description: "Is the local Laya decision model on and reachable, and which checkpoints are loaded. Call once before laya_decide. " + LAYA_RULES.split("\n\n")[0],
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return text({ ...(await layaHealth()), rules: LAYA_RULES });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "laya_decide",
    {
      description: "Ask Laya typed questions (choice, score, yes/no) about one state or many. Returns each answer with a probability, which is uncalibrated: a suggestion to verify, never the sole basis for a Figma write.\n\n" + LAYA_RULES,
      inputSchema: {
        state: z.union([z.string(), z.record(z.string(), z.any())]).optional().describe("One thing to judge: short text or a small JSON object (about 300 words at most)."),
        states: z.array(z.union([z.string(), z.record(z.string(), z.any())])).max(200).optional().describe("Many things to judge with the same questions. Preferred over many single calls."),
        model: z.enum(["english", "multilingual", "typed-decisions"]).optional().describe("Pin a checkpoint. Default: Laya routes by language. Pin english for English UI text to avoid loading a second model."),
        questions: z.record(z.string(), question).describe("Named questions, for example { role: { type: 'choice', instructions: 'Role of this layer?', criteria: { button: '...', icon: '...' } } }."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ state, states, questions, model }) => {
      try {
        const list = states && states.length ? states : state !== undefined ? [state] : null;
        if (!list) throw new Error("Give state or states.");
        for (const [k, q] of Object.entries(questions)) {
          const n = Object.keys(q.criteria || {}).length;
          if (q.type === "choice" && Array.isArray(q.criteria)) throw new Error(`Question '${k}': give choice options as { key: short description }, not a list.`);
          if (q.type === "choice" && (n < 2 || n > 11)) throw new Error(`Question '${k}': a choice needs 2 to 11 options (it has ${n}). Split bigger sets into rounds.`);
          if (q.type === "score" && n < 2) throw new Error(`Question '${k}': a score needs at least 2 levels, lowest first.`);
        }
        const sent = toServerQuestions(questions);
        const t0 = Date.now();
        const results = [];
        for (const s of list) {
          const r = await layaPredict(s, sent, undefined, 30000, model);
          results.push({ answers: r.answers, routing: r.routing });
        }
        return text({ count: results.length, ms: Date.now() - t0, note: "Probabilities are uncalibrated. Verify before acting.", results: states ? results : results[0] });
      } catch (e) {
        if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(String(e?.cause?.code || e?.message))) {
          return fail(new Error(`Laya is not reachable at ${process.env.FIGMA_WRITE_LAYA_URL}. Start laya-serve or unset FIGMA_WRITE_LAYA_URL, then decide this yourself; do not retry in a loop.`));
        }
        return fail(e);
      }
    }
  );
}
