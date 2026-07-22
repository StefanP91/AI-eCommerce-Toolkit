import {
  callGeminiJson,
  clean,
  clip,
  isGeminiConfigured,
  stripHtml,
} from "./gemini.server";

export const TOOL_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "es", label: "Spanish" },
  { code: "nl", label: "Dutch" },
  { code: "sr", label: "Serbian" },
  { code: "mk", label: "Macedonian" },
  { code: "hr", label: "Croatian" },
  { code: "bg", label: "Bulgarian" },
  { code: "el", label: "Greek" },
  { code: "tr", label: "Turkish" },
] as const;

export const TOOL_TONES = [
  "professional",
  "friendly",
  "luxury",
  "premium",
  "technical",
  "casual",
] as const;

const LANG_NAMES: Record<string, string> = Object.fromEntries(
  TOOL_LANGUAGES.map((lang) => [lang.code, lang.label]),
);

export type TranslateFields = {
  title: string;
  descriptionHtml: string;
  metaTitle: string;
  metaDescription: string;
};

export async function translateProductContent(input: {
  sourceLanguage: string;
  targetLanguage: string;
  fields: TranslateFields;
}): Promise<TranslateFields> {
  const source = LANG_NAMES[input.sourceLanguage] || input.sourceLanguage;
  const target = LANG_NAMES[input.targetLanguage] || input.targetLanguage;

  const payload = {
    title: input.fields.title,
    descriptionHtml: input.fields.descriptionHtml,
    metaTitle: input.fields.metaTitle,
    metaDescription: input.fields.metaDescription,
  };

  if (!isGeminiConfigured()) {
    return {
      title: `[${input.targetLanguage}] ${payload.title}`,
      descriptionHtml: payload.descriptionHtml,
      metaTitle: `[${input.targetLanguage}] ${payload.metaTitle || payload.title}`,
      metaDescription: payload.metaDescription,
    };
  }

  const parsed = await callGeminiJson({
    temperature: 0.3,
    system:
      "You are a professional eCommerce translator. Translate ALL text values to the target language. Return JSON using EXACTLY the same keys as the input object. Preserve HTML tags in descriptionHtml. Do not include explanations.",
    prompt: `Translate the following product content from ${source} to ${target}. Return JSON with identical keys:\n${JSON.stringify(payload)}`,
  });

  return {
    title: clip(clean(String(parsed.title || payload.title)), 70),
    descriptionHtml: String(parsed.descriptionHtml || payload.descriptionHtml),
    metaTitle: clip(
      clean(String(parsed.metaTitle || parsed.title || payload.metaTitle)),
      60,
    ),
    metaDescription: clip(
      clean(String(parsed.metaDescription || payload.metaDescription)),
      155,
    ),
  };
}

export async function generateSeoTitles(input: {
  productName: string;
  tone?: string;
  language?: string;
  country?: string;
}): Promise<string[]> {
  const name = clean(input.productName);
  const tone = input.tone || "professional";
  const country = input.country || "US";
  const language = LANG_NAMES[input.language || "en"] || "English";

  if (!isGeminiConfigured()) {
    return Array.from({ length: 10 }, (_, index) =>
      clip(`${name} — Option ${index + 1} | Shop Online`, 70),
    );
  }

  const parsed = await callGeminiJson({
    temperature: 0.7,
    system:
      'Generate exactly 10 unique SEO product titles. Each title must be 30-70 characters. Never include tone or category labels. Return JSON: {"titles":["..."]}',
    prompt: `Product: ${name}\nLanguage: ${language}\nStyle: ${tone}\nCountry: ${country}\nGenerate 10 unique SEO titles for this product.`,
  });

  const titles = Array.isArray(parsed.titles) ? parsed.titles : [];
  return titles
    .map((title) => clip(clean(String(title)), 70))
    .filter(Boolean)
    .slice(0, 10);
}

export async function generateMetaDescription(input: {
  productName: string;
  tone?: string;
  language?: string;
  country?: string;
  descriptionHtml?: string;
}): Promise<string> {
  const name = clean(input.productName);
  const tone = input.tone || "professional";
  const country = input.country || "US";
  const language = LANG_NAMES[input.language || "en"] || "English";
  const existing = stripHtml(input.descriptionHtml || "").slice(0, 400);

  if (!isGeminiConfigured()) {
    return clip(
      `Shop ${name}. Quality product with fast shipping. Order online today.`,
      155,
    );
  }

  const parsed = await callGeminiJson({
    temperature: 0.6,
    system:
      'Generate an SEO meta description. Must be 120-160 characters. Never include tone/category labels. Return JSON: {"metaDescription":"..."}',
    prompt: `Product: ${name}\nLanguage: ${language}\nStyle: ${tone}\nCountry: ${country}\nExisting description: ${existing || "n/a"}\nGenerate one compelling meta description.`,
  });

  return clip(
    clean(String(parsed.metaDescription || parsed.meta_description || "")),
    155,
  );
}

export async function generateImageAltText(input: {
  productName: string;
  imageUrl?: string | null;
}): Promise<{
  altText: string;
  filenameSuggestion: string;
  seoTips: string[];
}> {
  const name = clean(input.productName);

  if (!isGeminiConfigured()) {
    return {
      altText: clip(`${name} product image`, 125),
      filenameSuggestion: `${slugify(name)}.jpg`,
      seoTips: [
        "Keep alt text descriptive and under 125 characters",
        "Include the main product keyword naturally",
        "Avoid stuffing keywords or starting with Image of",
      ],
    };
  }

  const parsed = await callGeminiJson({
    temperature: 0.4,
    system:
      'You analyze product images for eCommerce SEO. Return valid JSON only: {"altText":"...","filenameSuggestion":"seo-name.jpg","seoTips":["tip1","tip2","tip3"]}',
    prompt: `Analyze this product for eCommerce SEO alt text.
Product: ${name}
Image URL (may be unused): ${input.imageUrl || "n/a"}
Return JSON with:
- altText: descriptive alt 20-125 chars
- filenameSuggestion: seo-friendly-name.jpg
- seoTips: 3 short tips`,
  });

  const tips = Array.isArray(parsed.seoTips)
    ? parsed.seoTips.map((tip) => String(tip))
    : Array.isArray(parsed.seo_tips)
      ? parsed.seo_tips.map((tip) => String(tip))
      : [];

  let altText = clean(
    String(parsed.altText || parsed.alt_text || `${name} product image`),
  );
  if (altText.length < 20) {
    altText = `${altText} for online shopping`.trim();
  }

  return {
    altText: clip(altText, 125),
    filenameSuggestion: clean(
      String(
        parsed.filenameSuggestion ||
          parsed.filename_suggestion ||
          `${slugify(name)}.jpg`,
      ),
    ),
    seoTips: tips.slice(0, 4),
  };
}

export function buildProductSchema(input: {
  productName: string;
  description?: string;
  productUrl?: string;
  imageUrl?: string;
  sku?: string;
  brand?: string;
  price?: string;
  currency?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: clean(input.productName),
  };

  if (input.description) schema.description = stripHtml(input.description);
  if (input.imageUrl) schema.image = input.imageUrl;
  if (input.productUrl) schema.url = input.productUrl;
  if (input.sku) schema.sku = input.sku;
  if (input.brand) {
    schema.brand = { "@type": "Brand", name: clean(input.brand) };
  }
  if (input.price) {
    schema.offers = {
      "@type": "Offer",
      price: String(input.price),
      priceCurrency: input.currency || "USD",
      availability: "https://schema.org/InStock",
      ...(input.productUrl ? { url: input.productUrl } : {}),
    };
  }

  return {
    schema,
    jsonLd: JSON.stringify(schema, null, 2),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
