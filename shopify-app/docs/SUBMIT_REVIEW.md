# Submit for App Store review

Complete after production deploy + listing assets.

1. Partner Dashboard → **Distribution → Public** (Draft OK until approved).
2. Confirm production env: `BILLING_DEV_BYPASS=0`, `BILLING_TEST_CHARGES=0` for live (use test charges only while verifying on dev stores).
3. Run [`SMOKE_CHECKLIST.md`](SMOKE_CHECKLIST.md).
4. Upload listing from [`APP_STORE_LISTING.md`](APP_STORE_LISTING.md).
5. Run Partner **automated checks**; fix any failures (especially compliance webhooks + HMAC).
6. Click **Submit for review**.

Review is manual on Shopify’s side — this repo cannot submit for you.
