import {
  callGeminiJson,
  clean,
  clip,
  isGeminiConfigured,
  stripHtml,
} from "./gemini.server";
import { replaceStorePlaceholders } from "./shop-name.server";

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
  storeName?: string;
}): Promise<GeneratedProductContent> {
  const storeName = (input.storeName || "").trim() || "our store";

  if (!isGeminiConfigured()) {
    return fallbackContent(input, storeName);
  }

  const prompt = `You are an expert eCommerce SEO copywriter for Shopify stores.
Return ONLY valid JSON with these keys:
- title: improved product title (max 70 chars)
- descriptionHtml: compelling HTML product description with <p> and <ul><li> bullets (200-400 words worth)
- metaTitle: SEO meta title 30-60 characters
- metaDescription: SEO meta description 120-155 characters

Store name: ${storeName}
Never use placeholders like [Store Name] — always use "${storeName}" when a store/brand name is needed.

Product title: ${input.title}
Existing description (may be empty): ${stripHtml(input.descriptionHtml || "").slice(0, 800)}
`;

  const parsed = await callGeminiJson({ prompt, temperature: 0.6 });

  return {
    title: clip(
      replaceStorePlaceholders(String(parsed.title || input.title), storeName),
      70,
    ),
    descriptionHtml: replaceStorePlaceholders(
      String(
        parsed.descriptionHtml ||
          fallbackContent(input, storeName).descriptionHtml,
      ),
      storeName,
    ),
    metaTitle: clip(
      replaceStorePlaceholders(
        String(parsed.metaTitle || input.title),
        storeName,
      ),
      60,
    ),
    metaDescription: clip(
      replaceStorePlaceholders(
        String(
          parsed.metaDescription ||
            fallbackContent(input, storeName).metaDescription,
        ),
        storeName,
      ),
      155,
    ),
  };
}

function fallbackContent(
  input: {
    title: string;
    descriptionHtml?: string;
  },
  storeName: string,
): GeneratedProductContent {
  const title = clean(input.title || "Product");
  const plain = stripHtml(input.descriptionHtml || "");

  let metaTitle = title.length < 30 ? `${title} | ${storeName}` : title;
  metaTitle = clip(metaTitle, 60);

  let metaDescription =
    plain.length >= 80
      ? plain
      : `Shop ${title} at ${storeName}. Quality product with fast shipping. Order online today.`;
  metaDescription = clip(metaDescription, 155);

  const descriptionHtml =
    plain.length > 40
      ? `<p>${plain}</p>`
      : `<p>Discover ${title} at ${storeName} — crafted for everyday use with reliable quality.</p><ul><li>High-quality materials</li><li>Fast shipping</li><li>Easy returns</li></ul>`;

  return {
    title,
    descriptionHtml,
    metaTitle,
    metaDescription,
  };
}
