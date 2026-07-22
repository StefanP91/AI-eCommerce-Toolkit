# Test product import (100 items)

Use these CSV files to populate your **development store** for testing AI Commerce Suite.

**Files:**
- `fixtures/shopify-products-100.csv` — products without images
- `fixtures/shopify-products-100-with-images.csv` — same products with a simple placeholder image each

## Import in Shopify

1. Open your dev store Admin
2. **Products** → **Import**
3. Choose one of the CSV files above
4. Click **Upload and preview** → **Import products**
5. Wait until all 100 products are created

For the **with-images** file, Shopify downloads one direct JPEG placeholder per product during import (from placehold.co). Your store needs internet access for that step.

## What's inside

- 100 simple products with short descriptions (weak SEO on purpose)
- Empty SEO title & meta description — good for testing **Generate with AI**
- Tag: `test-import`, `ai-suite`
- SKU prefix: `TEST-001` … `TEST-100`
- Image version: one 600×600 placeholder image per product

## Regenerate

```bash
cd shopify-app
node scripts/generate-products-csv.mjs
```

## Remove test products later

Products → filter by tag `test-import` → select all → delete.
