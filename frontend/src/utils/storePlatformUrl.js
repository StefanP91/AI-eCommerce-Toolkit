import { getStorePlatform } from '../constants/storePlatforms';

export function detectPlatformFromUrl(url) {
  try {
    const raw = (url || '').trim();
    if (!raw) return null;

    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = parsed.hostname.toLowerCase();

    if (host.endsWith('.myshopify.com') || host === 'myshopify.com') return 'shopify';
    if (host.endsWith('.mybigcommerce.com') || host === 'mybigcommerce.com') return 'bigcommerce';
    if (host.endsWith('.wixsite.com') || host === 'wixsite.com') return 'wix';
    if (host.endsWith('.squarespace.com') || host === 'squarespace.com') return 'squarespace';
    if (host.endsWith('.square.site') || host === 'square.site') return 'square';

    return null;
  } catch {
    return null;
  }
}

export function validateStoreUrlForPlatform(url, platformId) {
  const platform = getStorePlatform(platformId);
  if (!platform) {
    return { valid: false, message: 'Choose a platform before connecting your store URL.' };
  }

  const detected = detectPlatformFromUrl(url);
  if (detected && detected !== platformId) {
    const detectedPlatform = getStorePlatform(detected);

    return {
      valid: false,
      message: `This URL looks like ${detectedPlatform?.label ?? detected}, but you selected ${platform.label}. Choose the matching platform or paste the correct storefront URL.`,
    };
  }

  return { valid: true, message: null };
}
