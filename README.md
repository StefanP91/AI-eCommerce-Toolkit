# AI Commerce Suite

AI-powered toolkit for eCommerce sellers. Generate product copy, optimize SEO, translate listings, scan live stores, and export ready-to-use content in seconds.

**Live app:** [ai-ecommerce-suite.netlify.app](https://ai-ecommerce-suite.netlify.app)  

**Built for:** Shopify, WooCommerce, BigCommerce, Wix, Magento, Squarespace, PrestaShop, OpenCart, Square Online, and marketplace sellers.

---

## What it does

| Tool | Purpose |
|------|---------|
| **AI Product Generator** | Full product descriptions, SEO titles, and bullet points from a name, URL, or manual input |
| **Title & Meta Generator** | SEO titles and meta descriptions with Google preview |
| **SEO Audit** | Score product pages and get actionable recommendations |
| **Translator** | Localize product content across 12 languages |
| **Image Optimizer** | AI alt text, filename suggestions, compression, and SEO tips |
| **Schema Generator** | JSON-LD Product schema for rich search results |
| **Bulk Upload** | Process up to 100 products from CSV or Excel |
| **Store Overview** (Pro) | Connect a store URL, auto-scan the public catalog, audit SEO scores, bulk fix, and publish |

**Also includes:** saved projects, generation history, multi-format export (TXT, CSV, Excel, JSON), user accounts, admin panel, Free / Pro plans with Lemon Squeezy checkout.

### Store platforms

| Platform | Scan & audit | Guided publish setup | One-click API push |
|----------|:------------:|:--------------------:|:------------------:|
| Shopify | ✓ | ✓ | ✓ (Admin API / OAuth) |
| WooCommerce | ✓ | ✓ (REST keys) | — |
| BigCommerce | ✓ | ✓ | — |
| Wix, Magento, Squarespace, PrestaShop, OpenCart, Square | ✓ | ✓ | — |

Store scanning discovers product URLs from public sitemaps (including BigCommerce `/xmlsitemap.php`) and audits pages in batches with a live progress bar and ETA.

---

## Tech stack

- **Backend:** Laravel 12, PHP 8.2+, Sanctum
- **Frontend:** React, Vite, React Bootstrap
- **Shopify app:** React Router embedded app (`shopify-app/`) for App Store install
- **AI:** Google Gemini (default), OpenAI fallback
- **Database:** SQLite (local) / PostgreSQL (production)

---



## Plans

| | Free | Pro ($19/mo) |
|---|:---:|:---:|
| AI generations / day | 20 | Unlimited |
| Products / month | 50 | Unlimited |
| All content tools | ✓ | ✓ |
| Bulk upload (100 rows) | ✓ | ✓ |
| Store connect & SEO scan | — | ✓ |
| Shopify one-click push | — | ✓ |
| Priority support | — | ✓ |

Pro signup opens Lemon Squeezy checkout, then returns to the dashboard after payment.

---

## Project structure

```text
├── backend/     Laravel API (Render)
├── frontend/    React SPA (Netlify)
├── netlify.toml Sitemap + SPA routing
└── README.md
```

---


## License

Proprietary — AI Commerce Suite
