# AI Commerce Suite — Shopify App (standalone)

Embedded Shopify Admin app. Merchants install it and optimize products **inside Shopify** — no visit to the web SaaS required.

## What it does

- Lists products from the store
- Generates AI title, HTML description, SEO meta (Gemini)
- Writes results directly to the Shopify product

## Setup

```bash
cd shopify-app
npm install
cp .env.example .env
npx shopify app env pull
```

Add your Gemini key to `.env`:

```env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
```

Link & run:

```bash
npm run config:link
npm run dev
```

Press `p` for Preview in Admin.

## App icon

Branding files are in `public/branding/`:

| File | Use |
|------|-----|
| `app-icon-1200.png` | Upload in Partner / Dev Dashboard (App settings → icon, **1200×1200**, max **1MB**) |
| `app-icon-1024.png` | Older size (do not use for Shopify upload) |
| `app-icon.svg` | Source vector |
| `nav-icon.svg` | Optional embedded nav icon (Partner → App setup → Embedded app) |

**Upload in Shopify Partners:**
1. [partners.shopify.com](https://partners.shopify.com) → **Apps** → **AI Commerce Suite**
2. **Settings** (or Dev dashboard → App → Settings)
3. Upload `public/branding/app-icon-1200.png` as the app icon (**1200×1200** PNG)
4. Save — may take a few minutes to appear in Admin

## App Store path

1. Finish UX + privacy policy + support URL
2. `npm run deploy`
3. Submit listing for review in Partner Dashboard

## Note

This app is a **separate product channel** from `frontend/` (Netlify). Same brand, independent install flow for Shopify merchants.
