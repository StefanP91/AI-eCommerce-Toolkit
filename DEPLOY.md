# Deploy: Cloudflare Pages + Render

Чекор-по-чекор водич за бесплатен production deploy на **AI Commerce Suite**.

## Архитектура

```
Корисник → Cloudflare Pages (React SPA)
              ↓ API повици
         Render (Laravel API + PostgreSQL)
              ↓ webhooks (подоцна)
         Lemon Squeezy (наплата)
```

| Дел | Платформа | URL пример |
|-----|-----------|------------|
| Frontend | Cloudflare Pages | `https://ai-commerce.pages.dev` |
| Backend API | Render Web Service | `https://ai-commerce-api.onrender.com` |
| База | Render PostgreSQL | internal (не е јавна) |

---

## Предуслови

1. **GitHub account** + проектот push-нат на GitHub
2. **Cloudflare account** (бесплатно) → [dash.cloudflare.com](https://dash.cloudflare.com)
3. **Render account** (бесплатно) → [render.com](https://render.com)
4. Локално генерирај `APP_KEY`:
   ```bash
   cd backend
   php artisan key:generate --show
   ```
   Зачувај го излезот (на пр. `base64:xxxxx...`).

---

## Чекор 1: GitHub

Ако проектот уште не е на GitHub:

```bash
cd "C:\Users\stefa\Desktop\Git Hub\AI eCommerce Toolkit"
git init
git add .
git commit -m "Prepare for Cloudflare + Render deploy"
git branch -M main
git remote add origin https://github.com/TVOJ-USERNAME/ai-commerce-suite.git
git push -u origin main
```

**Важно:** `.env` фајловите се gitignored — API клучевите НЕ одат на GitHub.

---

## Чекор 2: Render (Backend + Database)

### 2.1 PostgreSQL база

1. На [dashboard.render.com](https://dashboard.render.com) → **New +** → **PostgreSQL**
2. Name: `ai-commerce-db`
3. Plan: **Free**
4. Region: Frankfurt (EU) или најблиску до МК
5. **Create Database**
6. Зачувај **Internal Database URL** (ќе ти треба подоцна)

### 2.2 Laravel API (Docker)

1. **New +** → **Web Service**
2. Connect го GitHub repo-то
3. Поставки:

| Поле | Вредност |
|------|----------|
| Name | `ai-commerce-api` |
| Region | исто како базата |
| Root Directory | `backend` |
| Runtime | **Docker** |
| Plan | **Free** |

4. **Environment Variables** — додади:

| Key | Value |
|-----|-------|
| `APP_NAME` | `AI Commerce Suite` |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | `base64:...` (од чекор Предуслови) |
| `APP_URL` | `https://ai-commerce-api.onrender.com` (твојот Render URL) |
| `FRONTEND_URL` | `https://ai-commerce.pages.dev` (ќе го ажурираш по Cloudflare deploy) |
| `LOG_CHANNEL` | `stderr` |
| `DB_CONNECTION` | `pgsql` |
| `DB_URL` | Internal Database URL од 2.1 |
| `SESSION_DRIVER` | `database` |
| `CACHE_STORE` | `database` |
| `QUEUE_CONNECTION` | `database` |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | твојот Gemini клуч |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

5. **Create Web Service** — чекај 5–10 мин (прв build)

### 2.3 Провери backend

Отвори во прелистувач:

```
https://ai-commerce-api.onrender.com/up
```

Треба да видиш `{"status":"ok"}` или сличен health response.

**Забелешка:** Free tier „заспива“ после 15 мин неактивност. Првото вчитување може да трае 30–60 сек.

### 2.4 Admin корисник (по deploy)

На Render → твојот Web Service → **Shell**:

```bash
php artisan admin:promote stefan@example.com
```

Или регистрирај нов корисник преку frontend и промени го plan-от од Admin панелот.

---

## Чекор 3: Cloudflare Pages (Frontend)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
2. **Pages** → **Connect to Git** → избери го repo-то
3. Build settings:

| Поле | Вредност |
|------|----------|
| Project name | `ai-commerce` (или по избор) |
| Production branch | `main` |
| Framework preset | None |
| **Root directory** | `frontend` |
| **Build command** | `npm install && npm run build` |
| **Build output directory** | `dist` |

4. **Environment variables** (Production):

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://ai-commerce-api.onrender.com/api` |

5. **Save and Deploy**

6. По deploy ќе добиеш URL како: `https://ai-commerce.pages.dev`

### 3.1 Ажурирај FRONTEND_URL на Render

Врати се на Render → Environment → промени:

```
FRONTEND_URL=https://ai-commerce.pages.dev
```

Render ќе redeploy-не автоматски (потребно за CORS).

---

## Чекор 4: Тестирај production

1. Отвори `https://ai-commerce.pages.dev`
2. Регистрирај се / најави се
3. Тестирај **Translator** или **AI Generator**
4. Провери **Admin** (`/admin`) ако си admin

### Чести проблеми

| Проблем | Решение |
|---------|---------|
| CORS error | `FRONTEND_URL` на Render мора точно да одговара на Cloudflare URL (без `/` на крај) |
| 502 / timeout | Render service уште се буди — почекај 60 сек и refresh |
| Demo mode на AI | Провери `GEMINI_API_KEY` на Render env vars |
| 500 на login | Провери `DB_URL` и дали миграциите поминале (Render Logs) |
| React routes 404 | `frontend/public/_redirects` мора да е во repo (веќе е додаден) |

---

## Чекор 5: Custom domain (опционално)

### Cloudflare (frontend)
Pages → Custom domains → додади `app.tvojdomain.com`

### Render (API)
Settings → Custom Domains → `api.tvojdomain.com`

Потоа ажурирај:
- `VITE_API_URL=https://api.tvojdomain.com/api` (Cloudflare)
- `APP_URL` и `FRONTEND_URL` (Render)
- Redeploy frontend (Cloudflare auto-rebuild при env change)

---

## Чекор 6: Lemon Squeezy (наплата)

Откако имаш **јавен HTTPS URL**, можеш да вклучиш наплата:

1. Активирај store на [lemonsqueezy.com](https://lemonsqueezy.com)
2. Креирај Pro product ($19/мес)
3. Webhook URL (подоцна во кодот):
   ```
   https://ai-commerce-api.onrender.com/api/billing/webhook
   ```
4. Success URL:
   ```
   https://ai-commerce.pages.dev/settings?billing=success
   ```

Lemon Squeezy бара **Privacy Policy** и **Terms** страни — додади ги на frontend пред live mode.

---

## Алтернатива: Render Blueprint

Во repo root постои `render.yaml`. На Render:

1. **New +** → **Blueprint**
2. Connect repo → Render креира DB + API автоматски
3. Рачно додади: `APP_KEY`, `APP_URL`, `FRONTEND_URL`, `GEMINI_API_KEY`

---

## Трошоци

| Сервис | Free tier | Ограничување |
|--------|-----------|--------------|
| Cloudflare Pages | $0 | Unlimited bandwidth |
| Render Web | $0 | Cold start, 512 MB RAM |
| Render PostgreSQL | $0 | 1 GB, брише се после 30 дена неактивност |
| **Вкупно** | **$0** | Доволно за beta + Lemon Squeezy test mode |

За сериозен production (без cold start): Render paid ~$7/мес + DB ~$7/мес.

---

## Корисни команди

```bash
# Локално тестирај Docker build (опционално)
cd backend
docker build -t ai-commerce-api .
docker run -p 10000:10000 --env-file .env -e PORT=10000 ai-commerce-api

# Локално тестирај production frontend build
cd frontend
VITE_API_URL=https://ai-commerce-api.onrender.com/api npm run build
npm run preview
```

---

## Следен чекор

По успешен deploy → имплементација на **Lemon Squeezy billing** (Phase 5).
