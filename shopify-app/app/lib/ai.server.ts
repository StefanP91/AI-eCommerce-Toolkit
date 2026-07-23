import {
  callGeminiJson,
  clean,
  clip,
  isGeminiConfigured,
  stripHtml,
} from "./gemini.server";

export type GeneratedProductContent = {
  title: string;
  descriptionHtml: string;
  metaTitle: string;
  metaDescription: string;
};

/**
 * Standalone AI generation for the Shopify embedded app.
 * Uses Gemini (direct or via GEMINI_PROXY_URL) — no web SaaS UI dependency.
 */
export async function generateProductContent(input: {
  title: string;
  descriptionHtml?: string;
}): Promise<GeneratedProductContent> {
  if (!isGeminiConfigured()) {
    return fallbackContent(input);
  }

  const prompt = `You are an expert eCommerce SEO copywriter for Shopify stores.
Return ONLY valid JSON with these keys:
- title: improved product title (max 70 chars)
- descriptionHtml: compelling HTML product description with <p> and <ul><li> bullets (200-400 words worth)
- metaTitle: SEO meta title 30-60 characters
- metaDescription: SEO meta description 120-155 characters

Product title: ${input.title}
Existing description (may be empty): ${stripHtml(input.descriptionHtml || "").slice(0, 800)}
`;

  const parsed = await callGeminiJson({ prompt, temperature: 0.6 });

  return {
    title: clip(String(parsed.title || input.title), 70),
    descriptionHtml: String(
      parsed.descriptionHtml || fallbackContent(input).descriptionHtml,
    ),
    metaTitle: clip(String(parsed.metaTitle || input.title), 60),
    metaDescription: clip(
      String(parsed.metaDescription || fallbackContent(input).metaDescription),
      155,
    ),
  };
}

function fallbackContent(input: {
  title: string;
  descriptionHtml?: string;
}): GeneratedProductContent {
  const title = clean(input.title || "Product");
  const plain = stripHtml(input.descriptionHtml || "");

  let metaTitle = title.length < 30 ? `${title} | Buy Online` : title;
  metaTitle = clip(metaTitle, 60);

  let metaDescription =
    plain.length >= 80
      ? plain
      : `Shop ${title}. Quality product with fast shipping. Order online today.`;
  metaDescription = clip(metaDescription, 155);

  const descriptionHtml =
    plain.length > 40
      ? `<p>${plain}</p>`
      : `<p>Discover ${title} — crafted for everyday use with reliable quality.</p><ul><li>High-quality materials</li><li>Fast shipping</li><li>Easy returns</li></ul>`;

  return {
    title,
    descriptionHtml,
    metaTitle,
    metaDescription,
  };
}
