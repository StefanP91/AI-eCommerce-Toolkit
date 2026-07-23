# Production hosting (App Store)

Deploy a **stable HTTPS** URL — do not submit with Cloudflare trycloudflare / `shopify app dev` tunnels.

## Recommended hosts

- [Fly.io](https://fly.io)
- [Railway](https://railway.app)
- [Render](https://render.com)

Use the included [`Dockerfile`](../Dockerfile).

## Environment (production)

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `SHOPIFY_API_KEY` | Partner app client ID |
| `SHOPIFY_API_SECRET` | Partner app secret |
| `SCOPES` | `read_products,write_products` |
| `SHOPIFY_APP_URL` | `https://your-stable-host` |
| `GEMINI_API_KEY` | Google AI key |
| `GEMINI_MODEL` | `gemini-2.5-flash` (or current model) |
| `BILLING_TEST_CHARGES` | `0` for live charges; `1` only on development stores |
| `BILLING_DEV_BYPASS` | **must be `0`** (also ignored when `NODE_ENV=production`) |
| `DATABASE_URL` | Persistent SQLite path or Postgres URL (see below) |

## Database

Production uses **PostgreSQL** (`prisma/schema.prisma`).

1. Create a **Render PostgreSQL** instance.
2. Copy **Internal Database URL** into the web service `DATABASE_URL`.
3. On container start, `npm run docker-start` runs `prisma migrate deploy`.

Locally, set `DATABASE_URL` to the Render **External** URL (or a local Postgres). SQLite is no longer used.

## Shopify Partner URLs

After the host is live:

1. Set **App URL** to `https://your-stable-host`
2. Allowed redirection URL(s): `https://your-stable-host/auth/callback` (and `/auth/shopify/callback` if used)
3. Update `shopify.app.toml` `application_url` + `redirect_urls`, then run:
   ```bash
   cd shopify-app
   npx shopify app deploy
   ```
   This also registers compliance webhooks from the TOML.

## Smoke after deploy

1. Install on a development store from the install link.
2. Embedded app loads in Admin (no tunnel errors).
3. Optimize one product (AI works).
4. Upgrade to Pro with Billing (Public distribution required).
5. Trigger compliance webhook test if available: `shopify app webhook trigger`.

## Local Docker smoke

```bash
cd shopify-app
docker compose up --build
```

Point `SHOPIFY_APP_URL` at a public HTTPS tunnel only for temporary tests — not for App Store submission.
