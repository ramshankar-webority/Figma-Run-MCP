# Capnix (capnix.ai): Brand, Product and Website Analysis

Analysed 15-Sep-2026 from the live site https://capnix.ai (home, blog, about), desktop 1440 px and mobile 390 px.
Companion: `../social-media-library/REPORT.md`.

## Summary

**Capnix is Webority Technologies' business-loan service for Indian MSMEs.** It is not a lender: it builds the loan file with AI-assisted analysis, matches it to a lender panel, and runs the application to disbursal. It's **free for the borrower**, because lenders pay Capnix on disbursal. The site is clean, confident and **visually consistent with the social posts**: same Addington CF + Inter pairing, red `#FA4028`, dark hero and light sections. The biggest gaps:
- **No proof yet:** no lender names, numbers or real testimonials.
- **Chat widget covers the hero:** the AI chat opens over the main headline on desktop.
- **Tracking is broken:** the site's own Content Security Policy **blocks the Meta Pixel, Microsoft Clarity and Cloudflare analytics**, so paid social campaigns can't measure conversions.
- **Layout and accessibility:** a stray photo in the FAQ section, and 10 of 12 images have no alt text.

---

## 1. What Capnix is

| Item | Detail |
|---|---|
| **Product** | End-to-end business-loan facilitation: "Get your business funded. We run the whole loan for you." |
| **Owner** | Webority Technologies Private Limited (footer copyright, link to webority.com) |
| **Model** | Not a lender. Lenders fund and decide. Capnix prepares the file, matches lenders, runs the application. **Free to borrowers**; lenders pay on disbursal. About page mentions optional paid improvement plans |
| **Audience** | Indian MSMEs (trading, manufacturing, retail and e-commerce, professional services, healthcare, hospitality) |
| **Second audience** | Partners: CAs, DSAs, consultants refer businesses and earn a commission on disbursal (separate portal `partners.capnix.ai`) |
| **Entry point** | Enter **GST number**: "No hard credit enquiry, and nothing goes to a lender until you approve it." App at `app.capnix.ai` |
| **Products** | 15 loan products in 3 groups: Working capital (6), Growth & assets (4), Specialised MSME finance (5) |
| **Tools** | EMI calculator, "Are you loan-ready?" self-check, Blog (10 posts, Jul-2026), FAQ, AI chat assistant |
| **Contact** | Vipul Trade Centre, Sector 48, Gurugram · contact@capnix.ai · +91 9711 134 481 |
| **Social** | LinkedIn (a **showcase page** under Webority), Instagram `@capnix.ai`, Facebook |

**Positioning in one line:** *"We don't hand you a report and wish you luck. We carry your loan from ready to funded, and it costs you nothing."*

---

## 2. Home page structure

| # | Section | Headline | Notes |
|---|---|---|---|
| 1 | Hero (dark, flowing red/silver 3D wave) | "Get your business funded. **We run the whole loan for you.**" (red second line) | GST input + "Get started" CTA, privacy reassurance line |
| 2 | Intro | "We run the whole loan [photo pill] process, from ready to funded" | Inline rounded photo inside the headline |
| 3 | How it works (blush background) | "Your loan in three clear steps" | 3 cards: Share your business / We find the fit / Get your loan. Step labels coloured red, blue, green |
| 4 | Loan products | "What we get you funded on" | 3 numbered columns listing all 15 products |
| 5 | Why Capnix | "We carry your loan from start to disbursal" | Accordion (AI-assisted analysis, We run your application, Wider lender access, Getting funded is free) + mock "application.capnix" progress card |
| 6 | Industries (blush) | "Loans built for your sector" | 6 cards with line icons |
| 7 | Loan-ready prompt | "Not sure where you stand?" | Only a heading and a "See what lenders look for" button |
| 8 | Partners | "Partnerships that inspire growth" | Full-bleed handshake stock photo + white card + CTA |
| 9 | FAQ | "Have a question? Find answers here" | "Talk to our team" CTA + 7 questions |
| 10 | Footer (dark) | "We get your business funded" | Quick links, company, social, contact, login as Customer / Partner, legal |

---

## 3. Visual identity (site vs social)

| Element | capnix.ai | Social posts (Figma) | Match? |
|---|---|---|---|
| Headline font | **Addington CF** 500, H1 72 px, H2 62 px | Addington CF Demi Bold / Bold | ✅ (posts use heavier weight) |
| Body font | **Inter** 14-18 px | Inter | ✅ confirms Inter is a core brand font, but it's missing from the Figma brand guide |
| Brand red | `#FA4028` CTAs, highlights, eyebrow labels | `#FA4028` | ✅ |
| Text colours | `#071437` headings, `#252F4A` body, `#4B5675` / `#687088` secondary | Same Metronic-style tokens | ✅ |
| Accents | Blue `#1B84FF`, green `#17C653`/`#04B440` on step labels | Green on "the right way" | ✅ |
| Buttons | Fully rounded pills, arrow ↗ icon | Rounded pill + arrow → | ✅ (arrow direction differs: ↗ site, → social) |
| Logo | "Capnix™" wordmark with **™** | No ™ | ⚠️ inconsistent |
| Imagery | Stock photos (team, handshake, call centre) + 3D wave | 3D studio renders | ⚠️ two styles; social renders feel more ownable |
| Mood | Dark hero, light blush/white sections | Dark cover, light slides | ✅ |

**Verdict:** the website and the Capnix carousels share one coherent system. The **Webority IT-service square ads are the outlier**.

---

## 4. Messaging and tone

- **Voice:** plain, honest, reassuring. It admits limits ("We can't promise an approval", "An illustrative timeline. Each lender sets its own."). This builds trust in lending, a category with a lot of distrust.
- **Core promises:** end-to-end ownership, free to the borrower, no hard credit pull, more lenders, AI-assisted analysis.
- **Repeated phrases:** "run the whole loan", "lenders most likely to back you", "until the money is in your account". Consistent, though repeated 4 to 5 times on one page.
- **Social alignment:** the carousels (loan-ready file, 3 months before, reapply after rejection, interest rates) match the blog topics (documents, rejection reasons, bank statements, GST/ITR cross-checks, CIBIL without a hard pull). Social and blog support each other well.

---

## 5. Strengths

1. **Clear offer above the fold:** one line of value, one input (GST), one CTA, one reassurance.
2. **Low-friction start:** GST number only, no hard enquiry, and consent before anything goes to a lender.
3. **Transparent business model** stated on the home page and in the FAQ.
4. **Editorial, premium look** from the Addington CF serif + generous white space. It stands out from typical fintech blue.
5. **Two-sided funnel:** borrower and partner journeys both visible, with separate portals.
6. **Good information scent:** 15 product pages and 6 industry pages linked, plus calculators and a self-check. Strong SEO base.
7. **Mobile layout is solid:** no horizontal overflow, stacked hero, full-width CTA.

---

## 6. Issues found (flagged only, nothing changed or filed)

| # | Severity | Area | Issue |
|---|---|---|---|
| 1 | critical | Tracking | The site's **Content Security Policy blocks** `connect.facebook.net/fbevents.js` (**Meta Pixel**), `scripts.clarity.ms` (**Microsoft Clarity**) and `static.cloudflareinsights.com` (**Cloudflare analytics**). Instagram and Facebook campaigns can't record conversions, and session recordings don't load. Console shows 3 CSP errors on every page load |
| 2 | warning | Hero (desktop) | **AI chat panel opens over the hero**, covering the end of the H1 ("We run the whole loan for…") and the subtitle |
| 3 | warning | Trust | **No proof**: no named lenders, no numbers funded, no real testimonials (the case study is "Sample Textiles Pvt Ltd", illustrative), no founder or team names, no regulatory or compliance statement (RBI-regulated lending partners, DPDP data handling). Important for a financial service asking for GST data |
| 4 | warning | FAQ section | **Stray photo** (call-centre team) floats in the empty left column below the "Talk to our team" button, detached from any content |
| 5 | warning | Accessibility | **10 of 12 images have no `alt` text**. 24 links/buttons on mobile are under 32 px tall (small tap targets). 11 text elements under 12 px |
| 6 | warning | Accessibility | Red `#FA4028` on white is **3.6:1**: fails WCAG AA for small text such as "See the full process ↗", eyebrow labels ("HOW IT WORKS") and step labels |
| 7 | info | Why Capnix accordion | First row label "AI-assisted analysis" sits above an open panel titled "We run your application": labels and panel content look mismatched |
| 8 | info | Section 7 | "Not sure where you stand?" is a large, nearly empty band with one button. Weak for a key self-check CTA |
| 9 | info | Copy | Double space in H2 "We run the whole loan  process". Mobile H1 has no space after the full stop ("funded.We run") because the two spans join without one |
| 10 | info | Content | Mobile H2 "What we get you funded on" breaks with "on" orphaned. Floating "back to top" and chat buttons overlap body text on mobile |
| 11 | info | Brand | "Capnix™" on the site vs no ™ on social. Arrow icon ↗ on site vs → on social |
| 12 | info | Imagery | Generic stock (handshake, headset call centre) conflicts with the ownable 3D render style used on social |
| 13 | info | Blog | Newest post "Machinery and Equipment Loans" shows no date. Latest dated post is 22-Jul-2026, so there's been no new post in about 8 weeks |
| 14 | info | Social | LinkedIn is a **showcase page** under Webority, not a standalone Capnix company page. It limits followers and ad identity for Capnix |
| 15 | info | Repetition | "Run the whole loan / most likely to back you / until the money is in your account" repeats across hero, intro, steps, why, FAQ |
| 16 | info | Scroll reveal | Sections are invisible until scrolled into view (fade-in). Fine for users, but full-page previews, some crawlers and link-preview tools see blank sections |

---

## 7. Recommendations

**Fix now**
1. **Allow the tracking scripts in the site's Content Security Policy:** `https://connect.facebook.net`, `https://scripts.clarity.ms`, `https://static.cloudflareinsights.com` (and `https://www.facebook.com` in `img-src` / `connect-src` for the pixel). Without this, social ad spend can't be measured.
2. **Stop the chat auto-opening on desktop:** show a small launcher bubble, and open the panel only on click or after a delay once the hero is out of view.
3. **Remove or place the stray FAQ photo**, and fix the accordion label mismatch.
4. **Add alt text** to all content images, and darken red text under 24 px to `#D20600`.

**Next**
5. **Add a trust band under the hero:** lender types or logos (with permission), "₹X arranged / Y businesses", 2 real testimonials, a "Lending partners are RBI-regulated banks and NBFCs" line, and a DPDP-compliant data note next to the GST field.
6. **Make section 7 a real tool:** embed 3 to 4 "loan-ready" questions inline, and link to the full check.
7. **Unify the visual language:** replace stock photos with the 3D studio render style from the social carousels, standardise ™ usage and arrow icons.
8. **Keep Capnix social on the Capnix message:** loan education and borrower stories, with Webority IT-service ads on Webority channels.

**Growth**
9. **Repurpose the blog as carousels** (and the carousels as blog posts). The topics already overlap one to one.
10. **Move to a full Capnix LinkedIn company page** once the brand is ready to run ads under its own name.
11. **Resume blog cadence** (weekly), with dates on every post.

---

## Method and coverage

- Home page read completely (DOM: fonts, sizes, colours, 46 internal links, image alt audit), full-page screenshots at 1440 px and 390 px, plus a mid-page mobile viewport after scroll.
- Blog index and About page read via fetch. Product, industry, partner, calculator and loan-ready pages were **not** reviewed individually.
- Console errors captured on desktop and mobile loads.
- Not tested: form submission, `app.capnix.ai` / `partners.capnix.ai` flows, page speed, SEO metadata beyond title, description and OG image.
