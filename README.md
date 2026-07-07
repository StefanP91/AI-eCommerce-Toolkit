# AI Commerce Suite

AI-powered toolkit for eCommerce sellers. Generate product copy, optimize SEO, translate listings, and export ready-to-use content in seconds.

**Built for:** Shopify, WooCommerce, BigCommerce, and marketplace sellers who need faster product listings and better search visibility.

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

**Also includes:** saved projects, generation history, multi-format export (TXT, CSV, Excel, JSON), user accounts, admin panel, and Free / Pro plans.

---

## Tech stack

- **Backend:** Laravel 12, PHP 8.2+, Sanctum
- **Frontend:** React, Vite, React Bootstrap
- **AI:** Google Gemini (default), OpenAI fallback
- **Database:** SQLite (local) / PostgreSQL (production)

---

## Quick start

**Backend**
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. API runs at `http://localhost:8000`.

**AI setup** — add to `backend/.env`:
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash
```

Without an API key, the app runs in demo mode with sample content.

---

## Plans

| | Free | Pro |
|---|:---:|:---:|
| AI generations / day | 20 | Unlimited |
| Products / month | 50 | Unlimited |
| All tools | ✓ | ✓ |
| Bulk upload (100 rows) | ✓ | ✓ |
| Priority support | — | ✓ |

---

## Project structure

```
├── backend/    Laravel API
├── frontend/   React SPA
└── README.md
```

---

## License

Proprietary — AI Commerce Suite
