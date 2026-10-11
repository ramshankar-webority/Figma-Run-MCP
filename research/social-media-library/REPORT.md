# Capnix Social Media Library: Design Research and Analysis

Analysed 15-Sep-2026 · Figma file `Social-Media-Library` · section **Capnix** (`783:90`)

## Summary

The library holds **68 frames in 5 areas**: brand guide, background kit, empty template frames, 12 square posts, and **2 complete 10-slide carousels** plus 2 single posts. The **Capnix carousels are strong**: a clear, repeatable system (dark hero cover, 8 light "tip" slides, question CTA), a confident serif headline with red keyword highlights, and consistent 3D studio visuals. The weak spots are **brand and file hygiene**:
- **Off-message posts:** the "Square" posts sell Webority IT services and point to webority.com under the Capnix logo, which doesn't match Capnix's MSME-loan positioning on capnix.ai. (Capnix is a Webority product, so the logo itself is fine.)
- **Undocumented fonts:** the brand guide lists one typeface, but the posts use three.
- **Low contrast:** the brand red fails contrast for small text on white.
- **Copy and layer mistakes:** a truncated sentence, "Gst", "1 Months", a duplicated "Trusted by", overlapping text on one ad, and hidden leftover layers.

Fix those, fill the empty templates (Milestone, Hiring, Case Study), and the library is production-ready.

---

## 1. What is in the file

| Area (section) | Node | Contents |
|---|---|---|
| **Brand Colour & Typography** | `783:115` | Colour sheet, typography sheet, 4 logo lockups (red / white / black / black-alt) |
| **Backgrounds** | `783:91` | 8 dark-red gradient backgrounds + 2 light (lavender, white), all 1200×1200 |
| **Template Frames** | `783:329` | 16 **empty** size frames grouped by purpose: LinkedIn Ads, Service Spotlight, Milestone Achievement, Thought Leadership, Hiring Post, Case Study |
| **Square** | `783:479` | 12 finished 1:1 posts (1200×1200 and 1080×1080): case study, insight, service, product, founder-led ads |
| **Section 4** | `790:923` | Carousel A "How to make your business loan file look strong" (10 × 1200×1500) · Carousel B "How to prepare for a loan 3 months before" (10 × 1200×1500) · 2 single posts (reapply after rejection, compare interest rates) |

Layer count: 521 frames, 401 text layers, 147 rectangles, 71 ellipses, 55 vectors.

---

## 2. Brand system

### Colour
| Role | Values | Notes |
|---|---|---|
| Brand red | `#FA4028` (shades 50 `#FFD2BB` to 1000 `#000000`) | Used as the keyword highlight, CTA buttons, rules, footer link |
| Neutrals (guide) | `#FFFFFF` to `#00000A`, e.g. 700 `#3D465C` | **Not what the posts use** (see below) |
| Neutrals (actually bound in posts) | `TEXT/Heading #071437`, `TEXT/Text 1 #252F4A`, `TEXT/Text 3 #78829D`, `TEXT/Text 4 #99A1B7` | These are Metronic UI tokens, not the Capnix guide scale |
| Accents | Blue `#1B84FF`, Green `#17C653`, Amber `#D97706`, Red `#E82646` | Named "Medium severity / Achievements / High severity / Severe blocker": product-UI status names, not marketing roles |

- **Red is never a variable.** Every `#FA4028` in the posts is a raw hex, so a brand tweak means editing every post by hand.
- **CMYK** field in the brand colour card is empty.

### Typography
| Guide says | Posts actually use |
|---|---|
| **Addington CF** only (Display 52-120 px / 800, H1 40-60 / 800, H2 30-48 / 700, H3 22-32 / 700, Lead 18-24 / 600, Body 14-18 / 400, Labels 12-16 / 400) | **Addington CF** Demi Bold / Bold for headlines (96 px on carousels, 74 px uppercase on ads) · **Inter** Medium / SemiBold / Bold / ExtraBold for body, numbers and "VENDOR & PARTNER" (36-82 px) · **DM Sans** SemiBold for pill tags |

- The pairing (sharp serif headline + clean Inter body) works well, but **Inter and DM Sans are missing from the guide**.
- The guide's px ranges are web sizes. Social canvases (1200 px) use 2 to 4 times larger values, with no social scale documented.
- Carousel type sizes are good for mobile: headline 96 px, body 42 px, page number 40/32 px on a 1200 px canvas.

### Logo
Wordmark "Capnix" in Addington CF with a red dot over the i. 4 lockups provided. Placement is consistent: top-left at 80 px margin on carousels, top-centre or top-left on ads.

### Backgrounds
A good reusable kit: flat near-black, linear red gradients, and radial "glow" variants. They match the dark posts exactly. The 2 light backgrounds (lavender `#F3F0FF`-ish, white) are **not** what the light carousels use; those use a white base with soft blurred circles and a faint image texture.

---

## 3. Post system anatomy

### Carousel (1200×1500, 4:5): the strongest part of the library
| Slide | Pattern |
|---|---|
| **01 Cover** | Dark red/black background, 3D hero object (loan file, desk calendar), 3-line hook: small sans lead-in → **big red serif keyword** → white serif line → small sans qualifier. Footer: `capnix.ai` + "Swipe to explore →" |
| **02-09 Tips** | White background with soft blurred shapes. Optional red **month pill** ("Before 3 Months"). 2-line serif headline with **one red phrase**. 2-4 line Inter body. 85×6 px red rule. 3D studio illustration bottom-right. Footer: `capnix.ai` + `02/10 →` |
| **10 CTA** | Short brand statement with red "MSME owner" highlight, then a **question box** (red left border, pale red fill) to drive comments. Illustration. No page number. |

Consistent grid: 80 px side margins, headline block starts about 320 px from top, footer pinned 60 px from bottom. This is a genuine, reusable template.

### Single educational posts (1200×1500)
Centred typographic hook mixing sans + serif + colour (red "business loan", green "right", a "REJECTED" stamp), with a photo composite or 3D render below. Light and dark versions.

### Square ads (1200×1200 / 1080×1080)
Dark red-gradient backgrounds, uppercase serif or Inter headlines, pill tags ("CASE STUDY", "INSIGHT", "TECHNOLOGY PARTNER"), red pill CTA buttons, proof chips (CMMI L5, ISO, 150+ projects), founder photo cut-outs. **The content is Webority IT services** (webority.com, Parliament of India case study, AgencyFlow, Navneet Singh / Asraf Husain), not Capnix lending.

---

## 4. Visual design analysis

**Strengths**
- **One idea per slide**, with a big headline, short body and one visual. Very skimmable.
- **Red keyword highlighting** gives instant scanning and ties every slide to the brand colour.
- **Consistent 3D studio illustration style** (white desk, soft shadows, plants, pens). The series feels premium and cohesive.
- **Dark cover, light body** contrast makes the carousel's start obvious in a feed.
- **Clear progress cues** (`02/10 →`) and a swipe prompt on the cover.
- **Engagement CTA** as a question, which suits LinkedIn and Instagram comment behaviour.

**Weaknesses**
- **Square ads are a different design language**: uppercase serif, glowing streaks, founder cut-outs, dense proof chips. They don't feel like the calm editorial carousels.
- **Density on service ads:** headline, quote, sub-copy, CTA, 4-5 chips and a name block fight for attention at thumbnail size.
- **Illustrations contain fake text:** UI-like gibberish on documents and dashboards, typical of AI renders. It's fine at feed size, but visible on zoom.
- **Uneven headline treatment:** a colon on one headline ("business expenses:"), and red placement varies (sometimes the first line, sometimes mid-line).

---

## 5. Copy and content

- **Audience:** Indian MSME owners preparing for business loans. Topics: CIBIL, GST, bank statements, financials, loan amount, lender shortlist, reapplying, interest rates.
- **Voice:** direct, reassuring, practical ("Three months is enough time. Three days isn't."). Strong short contrasts ("Not started. Done."). Very good.
- **Overlap:** the two carousels repeat 4 of the same tips (separate expenses, CIBIL, 2 years of financials, how much you need). Publish them far apart, or make carousel B clearly the "timeline" version.
- **CTAs:** carousels end with a question but no save / follow / link-in-bio prompt. Service ads use "Book a Tech Consultation", "Start scaling your team", "Try out for free".

---

## 6. Platform and format fit

| Planned in Template Frames | Actually produced |
|---|---|
| LinkedIn Single Image Ad 1200×628, Carousel Ad 1080×1080 | none |
| Service Spotlight: IG/FB Feed 1080×1080, LinkedIn 1200×1200 | Square ads (Webority) |
| Milestone Achievement: IG/FB 1080, LinkedIn 1200, X 1600×900 | **none** |
| Thought Leadership: IG 1080, IG Portrait 1080×1350, LinkedIn 1200 | Carousels at **1200×1500** (4:5, fine, but a size not in the template set) |
| Hiring Post: IG 1080, Story 1080×1920, LinkedIn 1200 | **none** |
| Case Study: IG 1080, LinkedIn 1200, X 1600×900 | 1 Webority case study (square) |

Template frame size labels are wrong in 2 places (see issues 9-10).

---

## 7. Accessibility (WCAG contrast)

| Pair | Ratio | Verdict |
|---|---|---|
| Brand red `#FA4028` on white | **3.60:1** | Passes only for large text (headlines OK). **Fails** for the small `capnix.ai` footer link and "Before 3 Months" pill text |
| Page total `/10` `#78829D` on white | **3.83:1** | Fails for small text |
| White on red CTA button | 3.60:1 | Borderline for small button labels |
| Green `#17C653` "right" on white | **2.27:1** | Fails even as large text |
| Body `#252F4A` on white | 13.26:1 | Pass |
| Red on near-black | 5.37:1 | Pass |

A darker red for small text, such as shade 500 `#D20600` (about 5:1 on white), fixes most of these without changing the look.

---

## 8. Issues found (flagged only, nothing changed or filed)

| # | Severity | Where (node) | Issue |
|---|---|---|---|
| 1 | warning | Square `783:480`, `783:502`, `783:521`, `783:540`, `783:555`, `783:601`, `783:660`, `783:677`/`714`/`746`/`776` | **Off-message for Capnix** (corrected 15-Sep-2026: Capnix is a Webority product, so the logo itself is not wrong). These posts sell Webority IT services (Parliament of India case study, AI software team, AgencyFlow, staff augmentation) and point to **webority.com**, while capnix.ai positions Capnix purely as an MSME business-loan service. Under a Capnix logo they confuse the audience. Keep them for Webority channels, or add a clear "Capnix by Webority" endorsement and a Capnix-relevant message |
| 2 | warning | `783:677` (dark "Architect systems that scale") | **Duplicate text layer** "We design scalable, high-performance system architecture…" placed twice. It renders as overlapping, unreadable text |
| 3 | warning | `823:884` Carousel B slide 03 | Body copy **truncated**: "…so nothing is a last-minute scramble **lat**" |
| 4 | warning | `783:555` "AI-Powered Software Team" | **"Trusted by" appears twice** ("Trusted by / Trusted by Parliament of India, DRDO, J&J.") |
| 5 | warning | every carousel slide and single post (e.g. `790:952`) | Hidden **"DPDP Compliance partner"** pill (opacity 0, cyan border, DM Sans): leftover from another brand's template, exported invisibly and confusing for editors |
| 6 | warning | Brand guide vs posts | Guide documents Addington CF only. Posts also use **Inter** and **DM Sans**, and Metronic text tokens instead of the guide's neutral scale |
| 7 | warning | Accessibility | Small red text and `/10` grey fail WCAG AA. Green "right" (`790:1154`) fails even as large text |
| 8 | warning | Template Frames | Milestone, Hiring and Case Study categories have **no finished Capnix posts**. Template frames are empty placeholders |
| 9 | info | `783:401` | Frame labelled "Instagram / Facebook Story **1080×1920**, 9:16", but the frame is **1080×1350** |
| 10 | info | `783:410` | Frame labelled "Twitter/X **1600×900**, 16:9", but the frame is **1600×1080** |
| 11 | info | `823:1095`, `823:1135` | "Before **1 Months**" should be "Before 1 Month" |
| 12 | info | `790:983` Carousel A slide 03 | "**Gst** filings" should be "GST filings" |
| 13 | info | `790:925` Carousel A slide 02 | Stray colon "business expenses**:**" (no other headline has one) |
| 14 | info | `790:1043` Carousel A slide 06 | Body missing a final full stop ("…and can explain") |
| 15 | info | `793:1767` Carousel A slide 10 | "loan-ready means not just applying" is missing punctuation ("means: not just…") |
| 16 | info | `783:714`, `783:746` | Name spelled "**Asraf Husainn**" (double n), probably a typo; confirm spelling. Also "Chief Operating Officer" vs "COO" and "500+ projects" vs "18+ years" differ between the two variants |
| 17 | info | `783:746`, `783:776`, `783:677`, `783:714` | **Frame names swapped / misspelled**: "Staff Augumentation" (Augmentation) frames contain the "Architect systems" consultation ad, and "Tech Consultation" frames contain the staff-augmentation ad |
| 18 | info | `790:1185` | Section named "How to reapply for a business loan…" contains the **interest rates** post |
| 19 | info | `783:586` | "Say goodbye to complex project management" post has **no live text layers** (flattened), so it's not editable |
| 20 | info | Layer hygiene | Generic names: "Post", "Frame 2147223849", "Group 1321314885", blank names `" "`, unnamed sections, "Section 4". Carousel B frames named 52-61 out of slide order (`57` is slide 04) |
| 21 | info | Brand guide `783:117` | CMYK value empty. Accent colours named as UI severities ("Severe blocker") instead of marketing roles |
| 22 | info | Content | Carousels A and B repeat 4 tips. Carousels end without a save / follow prompt |
| 23 | info | Illustrations | 3D renders contain gibberish pseudo-text on documents and dashboards (AI render artefacts), visible when zoomed |

---

## 9. Recommendations (in priority order)

1. **Keep Capnix posts on the Capnix message.** Move the Webority IT-service ads to Webority channels, or rework them as "Capnix by Webority" loan-focused posts pointing to capnix.ai.
2. **Fix the text bugs** before any export: issues 2, 3, 4, 11-15.
3. **Update the brand guide** to what is really used: Addington CF (headlines) + Inter (body) + DM Sans (tags), a **social type scale** (e.g. Hero 96-120, Headline 72-96, Body 36-44, Label 20-28 on 1200 px), and the real text colour tokens.
4. **Turn the carousel into components**: Cover, Tip slide (with/without month pill), CTA slide, each with text properties and a slide-number property. Bind red and neutrals to **variables**.
5. **Accessibility pass:** use red 500 `#D20600` for text under about 40 px, darken `/10` to Text 1, and replace the green highlight with a darker green (e.g. `#0E8A3A`).
6. **Delete hidden leftovers** (DPDP pill) and rename frames and sections by content and slide order.
7. **Align ads with the carousel language:** fewer chips, one proof point, calmer backgrounds, Addington sentence-case headlines.
8. **Fill the missing templates** (Milestone, Hiring, Case Study, LinkedIn single-image ad, Story 1080×1920) using the carousel system, and fix the 2 wrong size labels.
9. **Content plan:** schedule the overlapping carousels apart, and add a save/follow line to CTA slides.

---

## Method and coverage

- **Structure:** full layer metadata for `783:90` (133 KB), all 68 top-level frames and all 401 text layers read and parsed.
- **Visuals:** screenshots of all 5 areas (brand, backgrounds, templates, square posts, both carousels, both single posts).
- **Code-level detail** (fonts, sizes, tokens, hidden layers) pulled for 2 representative posts: carousel slide `790:925` and square ad `783:521`. Font findings for other posts are inferred from those two plus screenshots.
- **Not checked:** image resolution and export settings, prototype links, comments, and version history.
