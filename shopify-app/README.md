# AI Commerce Suite — Shopify App

Embedded Shopify Admin app for [AI Commerce Suite](https://ai-ecommerce-suite.netlify.app).

Built from the official [Shopify React Router app template](https://github.com/Shopify/shopify-app-template-react-router).

## What it does (MVP)

- Installs as an **embedded app** inside Shopify Admin
- Lists recent products
- **Optimize SEO** writes meta title + description on the product
- Links out to the full web SaaS for AI generation, bulk, store audit, billing

## Requirements

- Node.js `>=20.19 <22` or `>=22.12`
- [Shopify Partner](https://partners.shopify.com/) account
- Development store

## Setup

```bash
cd shopify-app
npm install
cp .env.example .env
```

1. Create an app in [Shopify Partners](https://partners.shopify.com/) → **Apps** → **Create app**
2. Link the local project:

```bash
npm run config:link
# or: npx shopify app config link
```

3. Start local development (opens a tunnel + install link):

```bash
npm run dev
```

4. Install the app on your development store when the CLI prompts you.

## Scopes

Default scopes in `shopify.app.toml`:

- `read_products`
- `write_products`

## Next steps

1. Call the Laravel API (`AI_COMMERCE_API_URL`) for real AI product copy
2. Add bulk optimize + progress UI
3. Prepare App Store listing (privacy policy, screenshots, support)
4. Submit for Shopify App Store review

## Related

- Web app: `../frontend`
- API: `../backend` (existing Shopify OAuth connect for Pro users)
