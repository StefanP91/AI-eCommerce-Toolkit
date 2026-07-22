# AI Commerce Suite — Shopify App (standalone)

Embedded Shopify Admin app. Merchants install it and optimize products **inside Shopify** — no visit to the web SaaS required.

## What it does

- Dashboard SEO overview and activity
- Products: AI title, description, SEO meta, bulk translate / alt (Pro)
- Collections: AI SEO copy
- Tools: translator, titles/meta, image optimizer, product schema
- Free (20 AI/day) + Pro ($19/mo via Shopify Billing)

## App Store launch

See docs:

- [Partner distribution & billing test](docs/PARTNER_DISTRIBUTION_CHECKLIST.md)
- [Production hosting](docs/PRODUCTION_HOSTING.md)
- [Listing assets & copy](docs/APP_STORE_LISTING.md)
- [Smoke checklist](docs/SMOKE_CHECKLIST.md)
- [Submit review](docs/SUBMIT_REVIEW.md)

Privacy / Terms (also linked in Settings):

- https://ai-ecommerce-suite.netlify.app/privacy
- https://ai-ecommerce-suite.netlify.app/terms

## Local development

```bash
cd shopify-app
cp .env.example .env   # then fill keys
npm install
npx prisma migrate deploy
npm run dev
```

Requires Partner app with **Public** distribution for real Billing API tests (`BILLING_DEV_BYPASS=0`).
