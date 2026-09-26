// Client for Laya (github.com/NandhaKishorM/laya), a local decision model served by `laya-serve`
// (POST /v1/systemone, GET /health). Off unless FIGMA_WRITE_LAYA_URL is set.
// LAYA_RULES is the single source of the "when to use Laya" policy: it goes into the MCP server
// instructions (sent to every client model on connect) and into the laya_* tool descriptions.

export const LAYA_RULES = `Laya decision rules (webority-figma-write)
Laya is a small local decision model. It reads a short state (text or JSON) plus typed questions and returns an answer with a probability: "choice" (pick one option), "score" (ordinal rating) or "noul" (yes/no probability). It never writes text, runs in about 1 to 3 s per question on a CPU, costs nothing per call and keeps data on this PC.

USE Laya (laya_decide) when ALL of these hold:
- The decision is a pick, a rating or a yes/no over a closed set you can list, not something to write or design.
- The input fits in about 300 words (the English checkpoint reads 512 tokens, multilingual 1024).
- There are many of them (roughly 10 or more), or the user wants the call made locally and repeatably.
Good fits in this MCP:
- Code Connect: which code component matches a Figma component (already automatic in figma_get_code_connect_suggestions and figma_get_context_for_code_connect when Laya is on).
- Layer triage over a dump or snapshot: role of each layer (button, card, icon, decoration, text block), export as SVG, PNG or live HTML, "is this a heading", "is this decorative".
- Audits: yes/no checks over many layers or texts (off-brand colour name, placeholder copy, missing label), then you review the flagged ones.
- Ranking or routing many items into fixed buckets (priority, owner, section).

DO NOT use Laya for:
- Creative or design work: layout, visual choices, copy, naming ideas, code. Laya cannot generate text.
- A single decision you can make from the context you already have. Decide it yourself.
- Anything needing images, long documents, arithmetic or multi-step reasoning.
- The final word on a write. Laya confidence is uncalibrated: treat an answer as a suggestion, verify it before any figma_* write, and never apply a destructive change on Laya's answer alone.

HOW to ask:
- One question per decision, 2 to 11 options per choice question (split bigger sets into rounds, then a final among the winners).
- Keep criteria descriptions short and distinct; put the thing being judged in state, not in the question.
- Send many items at once with states[] instead of one call per item.
- Call laya_status first in a session. If Laya is off or unreachable, say so once and fall back to your own judgment; do not retry in a loop.`;

export const layaUrl = () => (process.env.FIGMA_WRITE_LAYA_URL || "").replace(/\/+$/, "");
const headers = () => ({ "content-type": "application/json", ...(process.env.FIGMA_WRITE_LAYA_KEY ? { authorization: "Bearer " + process.env.FIGMA_WRITE_LAYA_KEY } : {}) });

export async function layaHealth(url = layaUrl()) {
  if (!url) return { configured: false, hint: "Set FIGMA_WRITE_LAYA_URL to a running laya-serve (see the README)." };
  try {
    const res = await fetch(url + "/health", { headers: headers(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { configured: true, url, reachable: false, error: "HTTP " + res.status };
    return { configured: true, url, reachable: true, ...(await res.json()) };
  } catch (e) {
    return { configured: true, url, reachable: false, error: e.message, hint: "Start laya-serve or unset FIGMA_WRITE_LAYA_URL." };
  }
}

// model pins a checkpoint (english, multilingual, typed-decisions); without it laya-serve routes by language,
// which can load a second checkpoint mid-run on a symbol-heavy state.
export async function layaPredict(state, questions, url = layaUrl(), timeoutMs = 30000, model) {
  if (!url) throw new Error("Laya is off: FIGMA_WRITE_LAYA_URL is not set.");
  const res = await fetch(url.replace(/\/+$/, "") + "/v1/systemone", { method: "POST", headers: headers(), body: JSON.stringify(model ? { state, questions, model } : { state, questions }), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Laya answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
