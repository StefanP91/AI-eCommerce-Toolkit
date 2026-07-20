/**
 * Google Analytics 4 helpers.
 * Measurement ID: G-B3SG2DBW64 (override with VITE_GA_MEASUREMENT_ID if needed).
 */

const MEASUREMENT_ID = (
  import.meta.env.VITE_GA_MEASUREMENT_ID
  || 'G-B3SG2DBW64'
).trim();

function canTrack() {
  return Boolean(MEASUREMENT_ID) && typeof window !== 'undefined';
}

export function isAnalyticsEnabled() {
  return Boolean(MEASUREMENT_ID);
}

export function initAnalytics() {
  if (!canTrack() || window.__gaInitialized) return;

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    // Must push the Arguments object — same as Google's official snippet.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
  }

  // Avoid duplicate config if index.html already loaded the tag.
  if (!window.__gaConfigured) {
    window.gtag('config', MEASUREMENT_ID, {
      send_page_view: false,
    });
    window.__gaConfigured = true;
  }

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  window.__gaInitialized = true;
}

export function trackPageView(path, title = document.title) {
  if (!canTrack()) return;
  if (typeof window.gtag !== 'function') {
    initAnalytics();
  }
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: `${window.location.origin}${path}`,
  });
}

export function trackEvent(name, params = {}) {
  if (!canTrack()) return;
  if (typeof window.gtag !== 'function') {
    initAnalytics();
  }
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

export function trackSignUp(method = 'email', plan = 'free') {
  trackEvent('sign_up', { method, plan });
}

export function trackBeginCheckout(plan = 'pro', value = 19, currency = 'USD') {
  trackEvent('begin_checkout', {
    currency,
    value,
    items: [{ item_id: 'pro_monthly', item_name: 'AI Commerce Suite Pro', price: value, quantity: 1 }],
    plan,
  });
}

export function trackPurchase(plan = 'pro', value = 19, currency = 'USD') {
  trackEvent('purchase', {
    currency,
    value,
    transaction_id: `pro_${Date.now()}`,
    items: [{ item_id: 'pro_monthly', item_name: 'AI Commerce Suite Pro', price: value, quantity: 1 }],
    plan,
  });
}

export function trackUpgradeClick(source = 'pricing') {
  trackEvent('upgrade_click', { source });
}
