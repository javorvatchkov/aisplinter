# AISplinter website

Static multi-page site for **aisplinter.dev** with animated crystal-planet hero, feature sections, screenshot placeholders, and install docs.

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Hero animation, features, screenshots, how it works, CTA |
| Download | `download.html` | Docker, standalone, and Next.js embed install guides |
| Contact | `contact.html` | Links to GitHub / email, mailto contact form |

## Files

- `styles.css` — shared nav, cards, sections, code blocks, and form styles
- `index.html` — full landing page (preserves original canvas hero animation)
- `download.html` — tabbed install instructions
- `contact.html` — contact links + form

## Preview locally

```bash
cd website
npx --yes serve .
# open http://localhost:3000
```

Or open `index.html` directly in a browser.

## Deploy

Host on **GitHub Pages**, **Cloudflare Pages**, or **Netlify** — static files only.

Point `aisplinter.dev` at this folder.

## Brand

Visual direction: [`../../docs/BRAND.md`](../../docs/BRAND.md)
