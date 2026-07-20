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

## App Store path

1. Finish UX + privacy policy + support URL
2. `npm run deploy`
3. Submit listing for review in Partner Dashboard

## Note

This app is a **separate product channel** from `frontend/` (Netlify). Same brand, independent install flow for Shopify merchants.
