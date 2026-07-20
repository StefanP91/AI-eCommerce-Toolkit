/**
 * Lightweight SEO helper for the embedded Shopify app MVP.
 * Later this can call the Laravel AI Commerce Suite API instead.
 */
export function buildSeoFromProduct(input: {
  title: string;
  descriptionHtml?: string;
}): { metaTitle: string; metaDescription: string } {
  const title = cleanText(input.title || "Product");
  const plain = stripHtml(input.descriptionHtml || "");

  let metaTitle = title;
  if (metaTitle.length < 30) {
    metaTitle = `${metaTitle} | Buy Online`;
  }
  metaTitle = clip(metaTitle, 60);

  let metaDescription = plain;
  if (metaDescription.length < 80) {
    metaDescription = `Shop ${title}. Fast shipping, quality guaranteed. Order online today.`;
  }
  metaDescription = clip(metaDescription, 155);

  return { metaTitle, metaDescription };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}
