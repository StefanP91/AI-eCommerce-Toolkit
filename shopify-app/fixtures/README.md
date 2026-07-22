# Test product import (100 items)

Use this CSV to populate your **development store** for testing AI Commerce Suite.

**File:** `fixtures/shopify-products-100.csv`

## Import in Shopify

1. Open your dev store Admin
2. **Products** → **Import**
3. Choose `shopify-products-100.csv`
4. Click **Upload and preview** → **Import products**
5. Wait until all 100 products are created

## What's inside

- 100 simple products with short descriptions (weak SEO on purpose)
- Empty SEO title & meta description — good for testing **Generate with AI**
- Tag: `test-import`, `ai-suite`
- SKU prefix: `TEST-001` … `TEST-100`

## Regenerate

```bash
node scripts/generate-products-csv.mjs
```

## Remove test products later

Products → filter by tag `test-import` → select all → delete.
