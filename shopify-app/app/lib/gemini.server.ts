export async function callGeminiJson(options: {
  prompt: string;
  system?: string;
  temperature?: number;
  image?: { mimeType: string; base64: string };
}): Promise<Record<string, unknown>> {
  if (!isGeminiConfigured()) {
    throw new Error("AI generation is not configured");
  }

  const proxyUrl = process.env.GEMINI_PROXY_URL?.trim();
  const proxySecret = process.env.GEMINI_PROXY_SECRET?.trim();

  // Prefer proxy when configured — Render EU IPs are often blocked by Gemini.
  if (proxyUrl && proxySecret) {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gemini-Proxy-Secret": proxySecret,
      },
      body: JSON.stringify({
        prompt: options.prompt,
        system: options.system,
        temperature: options.temperature ?? 0.5,
        image: options.image,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      console.error("[gemini-proxy]", response.status, detail);
      throw new Error(`AI generation failed (${response.status})`);
    }

    const json = (await response.json()) as { text?: string };
    return parseJson(json.text || "");
  }

  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [];

  if (options.system) {
    parts.push({ text: options.system });
  }
  if (options.image) {
    parts.push({
      inline_data: {
        mime_type: options.image.mimeType,
        data: options.image.base64,
      },
    });
  }
  parts.push({ text: options.prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: options.temperature ?? 0.5,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    console.error("[gemini]", response.status, detail);
    throw new Error(`AI generation failed (${response.status})`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseJson(raw);
}

export function parseJson(raw: string): Record<string, unknown> {
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

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export function isGeminiConfigured(): boolean {
  const proxyReady =
    Boolean(process.env.GEMINI_PROXY_URL?.trim()) &&
    Boolean(process.env.GEMINI_PROXY_SECRET?.trim());
  return proxyReady || Boolean(process.env.GEMINI_API_KEY?.trim());
}
