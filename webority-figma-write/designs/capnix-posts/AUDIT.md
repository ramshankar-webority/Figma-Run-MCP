# Capnix Posts Audit (C, D, singles)

Audited 15-Sep-2026 · Social Media Library → frame `826:2` · 22 posts. Checked with automated layout checks inside Figma, a visual review of every exported slide, and a copy and number check.

## Verdict

**Strong and publish-ready as a set, with 4 known limits** (end of file). Layout, type, spacing and colour now match the Capnix library exactly; every render is unique across the 22 posts; numbers are verified; all audit issues found were fixed.

## Checks and results

| Area | Check | Result |
|---|---|---|
| Canvas | All posts 1200 × 1500 | ✅ |
| Grid | 80 px side margins, headline at y 319, body at y 539, rule 85×6 | ✅ identical to library |
| Headlines | Addington CF Demi Bold, one size per slide | ✅ fixed (5 slides mixed 92/96 px → all 96) |
| Body | Inter Medium 42, width 954, ≤ 4 lines | ✅ fixed (C05 trimmed from 4 to 3 lines so the render has room) |
| Footer | `capnix.ai` 53 px line box, page `NN/10`, arrow | ✅ fixed (re-measured font had grown it to 64 px, lifting the row 5 px) |
| Numbers | Addington CF digits use lining proportional figures (LNUM + PNUM) | ✅ applied to all 6 figure layers; automated check finds 0 old-style digits |
| Overflow | No text beyond the 1040 px column or into the footer zone | ✅ 0 found |
| Overlap | Render/infographic ≥ 90 px below body; nothing on footer text | ✅ fixed (C10 disclaimer hit a baked render → switched to a movable render) |
| Renders | No repeats across C, D, singles; each matches its topic | ✅ 20 unique visuals + 3 infographics |
| Hidden layers | No hidden or zero-opacity text | ✅ DPDP leftovers removed |
| Contrast | Small red text `#D20600` (≈5:1), `/10` grey `#4B5675`; dark posts keep brand colours | ✅ |
| Cards | D cover comparison cards equal height | ✅ fixed |
| Legibility | Smallest text 28 px (≈8.5 pt on a phone) | ✅ fixed (D09 footnote 24 → 28 px) |
| Compliance | "Capnix is not a lender…" on both CTA slides | ✅ added |
| Claims | "without a CIBIL hit" → "without a hard pull" (matches capnix.ai wording) | ✅ |

## Numbers verified

| Figure | Calculation | Shown |
|---|---|---|
| ₹10 lakh, 3 yrs, 11.5%, 0.5% fee | EMI ₹32,976 · interest ₹1,87,136 + fee ₹5,000 | **₹1,92,136** ✅ |
| ₹10 lakh, 3 yrs, 11%, 2% fee | EMI ₹32,739 · interest ₹1,78,594 + fee ₹20,000 | **₹1,98,594** ✅ |
| ₹10 lakh, 12%, 3 yrs | EMI ₹33,214 · interest ₹1,95,715 | ✅ |
| ₹10 lakh, 12%, 5 yrs | EMI ₹22,244 · interest ₹3,34,667 | ✅ |
| Difference | ₹3,34,667 − ₹1,95,715 = ₹1,38,952 | "₹1.39 lakh" ✅ |

## Known limits (not fixable without new assets or decisions)

1. **Reused renders:** all visuals come from the two published carousels, so regular followers will recognise them. New 3D renders need Magnific credits (about 100 each) or the design team.
2. **C10 render is small:** the approved-laptop render was scaled down to sit below the disclaimer. Fine, but a purpose-made smaller render would look more intentional.
3. **Figures are illustrative:** rates and fees are examples, labelled on D09 only; the tenure single has no footnote.
4. **Captions, hashtags and alt text** for posting are not written yet.
