# Flashbite: 10 minute delivery promo email

`index.html` is the sendable email. Open it in a browser to preview, or paste it into your
sending platform as a raw HTML template.

## Subject line options

1. Dinner in 10 minutes, not 40
2. Your first 3 orders: flat 100 rupees off each
3. Hungry? Ten minutes. That is it.

**Preheader:** Flat 100 rupees off your first 3 orders with code TEN10. Cooked to order, at
your door in 10 minutes.

## Build notes

- 600px table layout, all styles inline, `role="presentation"` on every layout table.
- Fonts: Outfit for headings, Inter for body, loaded from Google Fonts. Outlook is forced to
  Arial by an mso conditional, because Outlook otherwise falls back to Times New Roman when a
  web font heads the stack.
- Bulletproof CTAs: table cell plus a VML `roundrect` for Outlook.
- Dark mode via `prefers-color-scheme` plus `[data-ogsc]` for Outlook.com.
- 30 KB, well under the 102 KB point where Gmail clips a message.
- Mobile: single column below 620px, images go full width.

## Placeholders to swap before sending

| What | Where | Current value |
|---|---|---|
| Brand name | wordmark, footer, title | Flashbite (invented for this mockup) |
| Legal entity and address | footer | Flashbite Foods Private Limited, `[Street address], [City] [PIN]` |
| Every link | 7 `href`s | `https://example.com/...` |
| Signup line | footer | flashbite.example.com |
| Offer terms | coupon block | TEN10, flat 100 rupees off, minimum order 199 rupees, valid until 31-Oct-2026 |
| Claims | promise and trust blocks | 10:00 average, 4.7 rating, 1,20,000 orders a week, 40+ areas |

## Images

Six photos from Pexels, hotlinked from `images.pexels.com` for this mockup. Pexels is free to
use and needs no attribution, but their CDN is not an email image host: download the six files
and serve them from your own CDN before a real send.

| Section | Pexels photo |
|---|---|
| Hero | 1639562 |
| Margherita Pizza | 20115306 |
| Chilli Garlic Noodles | 2347311 |
| Double Patty Burger | 2874989 |
| Chocolate Fudge Slice | 132694 |
| Rider strip | 7362967 |

`preview/desktop.png` and `preview/mobile.png` are Chrome renders at 700px and 390px.
