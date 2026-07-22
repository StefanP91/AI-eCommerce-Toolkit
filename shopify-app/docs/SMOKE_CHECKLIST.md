# Pre-submit smoke checklist

Run on a **development store** against the **production HTTPS** app URL (not a tunnel).

## Install & embedded load

- [ ] Fresh install from install link completes OAuth
- [ ] App opens embedded in Shopify Admin
- [ ] Dashboard loads products / stats

## Free plan & AI

- [ ] Free plan shows usage (e.g. 0 / 20)
- [ ] Optimize one product: generate → review → apply
- [ ] Schema tool works without consuming AI quota incorrectly
- [ ] After 20 AI actions, further generate shows upgrade message
- [ ] Bulk optimize is blocked on Free with upgrade prompt

## Billing (Public distribution required)

- [ ] `BILLING_DEV_BYPASS` is unset/`0` and `NODE_ENV=production`
- [ ] Upgrade opens Shopify charge confirmation (`test: true` on dev store)
- [ ] Approve → Settings shows Pro; usage unlimited
- [ ] Decline → stays Free
- [ ] Cancel subscription in Admin → Refresh plan → Free
- [ ] Re-upgrade requests a new charge

## Compliance

- [ ] `shopify.app.toml` includes `compliance_topics` → `/webhooks/compliance`
- [ ] `npx shopify app deploy` released the version with webhooks
- [ ] Partner automated check “mandatory compliance webhooks” passes

## Legal & support

- [ ] Privacy URL on listing: https://ai-ecommerce-suite.netlify.app/privacy
- [ ] Terms URL on listing: https://ai-ecommerce-suite.netlify.app/terms
- [ ] Settings shows Support & legal links
- [ ] Support + emergency contacts set in Partner Dashboard

## Uninstall

- [ ] Uninstall removes session / shop data (or shop/redact later)
- [ ] Reinstall works cleanly

## Submit

- [ ] Listing assets uploaded (icon 1200², screenshots, copy)
- [ ] Partner automated checks all green
- [ ] Submit for App Store review
