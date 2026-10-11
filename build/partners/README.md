# Partners page, rebuilt as HTML from Figma

Rebuilt on 16-Sep-2026 from **Webority Partners V_2.0 → Page 7 → Section 11 → Partners** (node `3626:23239`), using the local `Figma-MCP-Webority` MCP. Nothing in the Figma file was changed.

Open `index.html` in a browser. It is a fixed 1440 px wide page, 8803 px tall, exactly like the frame.

## How close it is

Measured with ffmpeg SSIM against Figma's own PNG export of the same frame, at full size:

| | Score |
|---|---|
| Whole page | **0.927** (R 0.910, G 0.929, B 0.942) |
| Best bands | 0.97 (trusted vendors), 0.94 (services and partner app), 0.93 (hero, FAQ) |
| Weakest bands | 0.86 (programme intro), 0.87 (testimonials), 0.89 (final call to action) |

Remaining differences are font rasterisation (Chrome versus Figma antialiasing), and a few places where Figma renders fonts that are not installed on the viewing machine.


## Two builds in this folder

| File | What it is |
|---|---|
| `index.html` | The pixel-for-pixel rebuild of the Figma frame. Fixed 1440 px, absolute positioning, verified at 0.927 SSIM |
| `responsive.html` | A responsive, interactive version of the same page, built from the design's real content and assets |
| `viewer/viewer.html` | Offline design viewer: layer tree, search, click-to-highlight, specs, CSS and code mappings. Needs no Figma account |

### responsive.html

Breakpoints: full layout above 1080, tablet 981 to 1080, mobile below 980 (nav collapses into a menu) and a narrow pass below 760.

Interactions, all keyboard reachable and with visible focus rings:

- **Sticky header** that gains a border and shadow on scroll, with a hamburger menu that slides open below 980 px and closes itself if the window grows.
- **Scroll spy**: the nav underlines whichever section you are reading.
- **FAQ accordion**: click to open, one panel at a time, height animated with a CSS grid row (no hard-coded heights), plus-to-cross icon rotation, `aria-expanded` kept in sync.
- **Testimonials**: two horizontal rails moving in opposite directions, edge fade mask, pause on hover or keyboard focus, and drag to scrub with a pointer. The cards are duplicated in script so the loop never shows a gap.
- **Highlights strip**: infinite horizontal marquee that pauses on hover.
- **Reveal on scroll** via IntersectionObserver, staggered, with hover lift on process cards, service rows, app list items and buttons.
- **Reduced motion**: every animation and the smooth scrolling are disabled when the visitor asks for less motion.

Checked in a real browser at 390, 820, 1440: no horizontal overflow (`scrollWidth` 375 inside a 390 viewport), accordion state verified per panel, menu open and close verified, both rails animating.

Design fidelity: components use the design's own values, not invented styling. Cards are white at 12 px radius with 16 px padding and the file's own `0 30px 60px #919eab30` shadow; the chart card uses its `0 30px 70px #466efa33`. Buttons are flat brand fills with no glow, headers have a hairline instead of a shadow, phones and mockups carry the shadow baked into their own artwork, and the benefits visuals and benefit icons are the exported Figma artwork rather than substitutes.

FAQ answers: the design only contained the answer for question 02, since the rest are collapsed in Figma. The other answers are written from the programme copy on the same page, so review the wording before this goes live.

## What is in here

| Path | What |
|---|---|
| `index.html` | The page. Every layer absolutely positioned, real text, no framework |
| `assets/` | 52 SVG icons and illustrations, 23 PNG images, 14 MB total |
| `design.json` | The full design read from Figma, 1,129 layers, with Code Connect data merged in |
| `assets.json` · `items.json` | Which layer became which file |
| `mappings.json` | Code Connect mappings pulled from the file |
| `viewer/` | `viewer.html` over `render.png`, Figma's render of the frame |

## How it was built

```bash
cd "C:/Dev/Figma Run MCP/webority-figma-write"
# 1. read the frame            -> figma_get_node (depth 20, maxNodes 5000)
# 2. decide the assets
node tools/plan-assets.mjs <dump.json> ../build/partners
# 3. export them               -> figma_export_many (SVG for vectors, PNG at 2x for images)
# 4. attach code mappings
node tools/merge-code-connect.mjs <dump.json> ../build/partners/mappings.json ../build/partners/design.json
# 5. generate the page
node tools/figma-to-html.mjs ../build/partners/design.json ../build/partners ../build/partners/assets.json
# 6. verify (writes to verify/, a scratch folder that is not kept)
chrome --headless --window-size=1440,8803 --screenshot=verify/html.png index.html
ffmpeg -i verify/html.png -i viewer/render.png -lavfi "[0:v][1:v]ssim" -f null -
```

## Code Connect

Every layer carries `data-figma-id` and `data-name`, and instances also carry `data-component`, so you can trace any element back to Figma. Where a component has a code mapping, the element also carries `data-code-component` and `data-code-source`.

On this page nothing carries a code mapping yet: the 21 instances here are vuesax icons and three app-screen mockups, none of which are mapped. The two mappings in the file (`Button` to `AppButton`, `Navgation` to `AppBottomTab`) belong to components used on other pages. Mapping the icon set to `Icon` (`src/components/base/icons/Icon.js`) would tag most of this page, and takes one `figma_send_code_connect_mappings` call once you are happy for the file to be written to.

## Known gaps

- Fonts: the page asks Google Fonts for Inter and Fraunces. Zalando Sans, Gilroy and SF Pro appear in the design; without them installed a viewer sees Inter instead, exactly as this design would behave on any machine.
- Layout is absolute, not responsive. It reproduces the frame, it does not adapt to other widths.
- The hero phone sits a couple of pixels off its Figma position: it is placed by the centre of its rotated bounding box.
- Two empty layers failed to export and are not drawn; they have no visible content.
- Mockups that use a Figma mask (the three phones and the hero background artwork) are exported as one flat image each, because a mask composites in ways CSS cannot express layer by layer. Nothing containing text is ever flattened.
- Masks are approximated by clipping the group, which is right for the rectangular masks used here.
