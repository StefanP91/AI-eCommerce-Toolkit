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
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (proxyUrl && proxySecret) {
        return await callViaProxy(proxyUrl, proxySecret, options);
      }
      return await callDirect(options);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === 3) {
        throw error;
      }
      const delayMs = attempt * 700;
      console.warn(
        `[gemini] attempt ${attempt} failed, retrying in ${delayMs}ms`,
        error instanceof Error ? error.message : error,
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI generation failed");
}

async function callViaProxy(
  proxyUrl: string,
  proxySecret: string,
  options: {
    prompt: string;
    system?: string;
    temperature?: number;
    image?: { mimeType: string; base64: string };
  },
): Promise<Record<string, unknown>> {
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

  const rawBody = await response.text();
  if (!response.ok) {
    console.error("[gemini-proxy]", response.status, rawBody.slice(0, 300));
    throw new Error(`AI generation failed (${response.status})`);
  }

  let json: { text?: string; error?: string };
  try {
    json = JSON.parse(rawBody) as { text?: string; error?: string };
  } catch {
    throw new Error("AI generation failed (bad proxy response)");
  }

  return parseJson(json.text || "");
}

async function callDirect(options: {
  prompt: string;
  system?: string;
  temperature?: number;
  image?: { mimeType: string; base64: string };
}): Promise<Record<string, unknown>> {
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

  const detail = await response.text();
  if (!response.ok) {
    console.error("[gemini]", response.status, detail.slice(0, 300));
    throw new Error(`AI generation failed (${response.status})`);
  }

  let json: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
  try {
    json = JSON.parse(detail);
  } catch {
    throw new Error("AI generation failed (invalid upstream JSON)");
  }

  if (json.promptFeedback?.blockReason) {
    throw new Error("AI generation failed (blocked)");
  }

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseJson(raw);
}

function shouldRetry(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /AI generation failed \((429|500|502|503|504)\)|fetch failed|ECONN|ETIMEDOUT|network|aborted/i.test(
    message,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseJson(raw: string): Record<string, unknown> {
  const text = (raw || "").trim();
  if (!text) {
    throw new Error("AI returned invalid JSON");
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
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
