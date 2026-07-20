export type GeneratedProductContent = {
  title: string;
  descriptionHtml: string;
  metaTitle: string;
  metaDescription: string;
};

/**
 * Standalone AI generation for the Shopify embedded app.
 * Uses Gemini directly — no dependency on the web SaaS UI.
 */
export async function generateProductContent(input: {
  title: string;
  descriptionHtml?: string;
}): Promise<GeneratedProductContent> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  if (!apiKey) {
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI generation failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseJson(raw);

  return {
    title: clip(String(parsed.title || input.title), 70),
    descriptionHtml: String(parsed.descriptionHtml || fallbackContent(input).descriptionHtml),
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

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as Record<string, unknown>;
    }
    throw new Error("AI returned invalid JSON");
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}
