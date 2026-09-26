// Default colour tokens for the Webority Figma MCP.
// Source: Social Media Library colour sheet (file oioGF0QSVxYdMs82imRt68, node 1080:63), read 26-Sep-2026.
// Pure: no Figma dependency. The server resolves token names to hex before a spec reaches the plugin,
// so plugin/code.js keeps accepting hex only.

export const COLOR_TOKEN_GROUPS = {
  text: {
    heading: "#071437",
    "text-1": "#252F4A",
    "text-2": "#4B5675",
    "text-3": "#78829D",
    "text-4": "#99A1B7",
    "text-5": "#C4CADA",
    white: "#FFFFFF",
  },
  surface: {
    "border-dark": "#EBEDF3",
    "border-light": "#F4F6F8",
    "bg-dark": "#F5F6FA",
    "bg-light": "#F9FBFC",
  },
  info: {
    "info-active": "#056EE9",
    "info-100": "#1B84FF",
    "info-50": "#8DC2FF",
    "info-30": "#BBDBFF",
    "info-20": "#D1E6FF",
    "info-10": "#E9F3FF",
    "info-5": "#F3F9FF",
  },
  warning: {
    "warning-active": "#DFA000",
    "warning-100": "#F6B100",
    "warning-50": "#FBD880",
    "warning-30": "#FDE8B3",
    "warning-20": "#FDEFCC",
    "warning-10": "#FFF8E6",
    "warning-5": "#FEFBF2",
  },
  success: {
    "success-active": "#04B440",
    "success-100": "#17C653",
    "success-50": "#8BE3A9",
    "success-30": "#BAEECC",
    "success-20": "#D1F4DD",
    "success-10": "#E8FAEE",
    "success-5": "#F3FCF6",
  },
  error: {
    "error-active": "#E82646",
    "error-100": "#F8285A",
    "error-50": "#FC94AD",
    "error-30": "#FDBFCE",
    "error-20": "#FED4DE",
    "error-10": "#FFEAEF",
    "error-5": "#FEF4F6",
  },
};

export const COLOR_TOKENS = Object.freeze(Object.assign({}, ...Object.values(COLOR_TOKEN_GROUPS)));

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TOKEN_HEXES = new Set(Object.values(COLOR_TOKENS).map((h) => h.toLowerCase()));

// Token name -> hex. Hex and "none" pass through unchanged, so every spec that worked before still does.
export function resolveColor(value) {
  if (typeof value !== "string") return value;
  const key = value.trim().toLowerCase();
  if (Object.hasOwn(COLOR_TOKENS, key)) return COLOR_TOKENS[key];
  if (value === "none" || HEX.test(value.trim())) return value;
  throw new Error(`Unknown colour '${value}'. Use hex (#RGB, #RRGGBB, #RRGGBBAA), 'none', or a token: ${Object.keys(COLOR_TOKENS).join(", ")}.`);
}

// New spec with fill, stroke and text.color resolved at every level. Never mutates the input.
export function resolveSpecColors(spec) {
  if (!spec || typeof spec !== "object") return spec;
  const out = { ...spec };
  if (out.fill !== undefined) out.fill = resolveColor(out.fill);
  if (out.stroke !== undefined) out.stroke = resolveColor(out.stroke);
  if (out.text && out.text.color !== undefined) out.text = { ...out.text, color: resolveColor(out.text.color) };
  if (Array.isArray(out.children)) out.children = out.children.map(resolveSpecColors);
  return out;
}

// True when a hex (any case, alpha ignored) is one of the default tokens.
export const isTokenColor = (hex) => typeof hex === "string" && TOKEN_HEXES.has(hex.slice(0, 7).toLowerCase());

// Taught to every client model on connect (server instructions) and returned by figma_color_tokens.
export const COLOR_TOKEN_RULES = `Default colour tokens (webority-figma-write)
Use these by name for any fill, stroke or text colour instead of ad hoc hex. figma_create_from_spec accepts the names directly (e.g. fill: "info-100", text.color: "heading"); in figma_execute use the hex. figma_color_tokens returns the full table.
- Ink: heading ${COLOR_TOKENS.heading}, text-1 to text-5 (${COLOR_TOKENS["text-1"]} darkest to ${COLOR_TOKENS["text-5"]} lightest), white ${COLOR_TOKENS.white}.
- Surfaces: border-dark ${COLOR_TOKENS["border-dark"]}, border-light ${COLOR_TOKENS["border-light"]}, bg-dark ${COLOR_TOKENS["bg-dark"]}, bg-light ${COLOR_TOKENS["bg-light"]}.
- Status scales info, warning, success, error, each with -active, -100, -50, -30, -20, -10, -5. -100 is the base colour, -active is hover or pressed, -50 to -5 are tints for backgrounds and chips.
- Contrast (WCAG): white text reaches 4.5:1 only on info-active; it reaches 3:1 (large text) on info-100, error-active and error-100, and fails on every warning and success shade, so use heading there. On tints (-50 to -5) write text in heading or text-1; the -active shade on its own tints reaches only 3:1 (info and error at -10 and lighter) and fails elsewhere. For body text on white use heading, text-1 or text-2; text-3 is large text only; text-4 and text-5 are decorative.`;
