# App Store launch — Partner Dashboard checklist

Complete these steps in [Shopify Partners](https://partners.shopify.com) before submitting.

## 1. Public distribution (required for Billing API)

1. Open **Apps** → **AI Commerce Suite**.
2. Go to **Distribution**.
3. Choose **Public** (Draft is fine — you do **not** need to publish to the App Store yet).
4. Save.

Then in the embedded app:

1. Ensure `BILLING_DEV_BYPASS=0` in the environment you are testing.
2. Click **Upgrade to Pro** → **Upgrade & pay**.
3. Approve the **test** charge on the development store.
4. Confirm Settings shows **Pro**.
5. Cancel the subscription from Shopify Admin → Settings → Apps (or Billing).
6. Confirm the app returns to **Free** (webhook / Refresh plan status).
7. Reinstall or re-upgrade and confirm charge is requested again.

## 2. Support & emergency contacts

In Partner Dashboard account / app settings:

- Support email (e.g. `stefanpanov0@gmail.com`)
- Emergency developer contact (email + phone)

## 3. Listing (when ready to submit)

- App icon 1200×1200 PNG/JPEG
- Screenshots (Dashboard, Products, Tools, Settings/Plan)
- Copy from [`docs/APP_STORE_LISTING.md`](APP_STORE_LISTING.md)
- Privacy: `https://ai-ecommerce-suite.netlify.app/privacy`
- Terms: `https://ai-ecommerce-suite.netlify.app/terms`

## 4. Submit

1. Deploy production URL and set `SHOPIFY_APP_URL` + redirect URLs.
2. Run Partner **automated checks**.
3. Submit for App Store review.
