/**
 * Gemini proxy for hosts in Google geo-blocked regions (e.g. some Render EU IPs).
 * Secrets: GEMINI_PROXY_API_KEY (preferred), optional GEMINI_API_KEY fallback,
 * optional GEMINI_MODEL + GEMINI_MODEL_FALLBACKS, required GEMINI_PROXY_SECRET
 *
 * On 429/quota for the preferred model, tries fallbacks. Every new request
 * starts again at the preferred model so capacity recovers automatically.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Proxy-Secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify(body),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function modelChain(preferred) {
  const fromEnv = (process.env.GEMINI_MODEL_FALLBACKS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const list = [preferred, ...fromEnv, ...DEFAULT_FALLBACKS];
  const seen = new Set();
  return list.filter((model) => {
    const key = model.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isQuotaStatus(status, text) {
  return (
    status === 429 ||
    /RESOURCE_EXHAUSTED|quota|rate limit/i.test(text || "")
  );
}

async function callGeminiOnce(url, body, attempt = 1) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  if (
    !response.ok &&
    [500, 502, 503, 504].includes(response.status) &&
    attempt < 3
  ) {
    await sleep(attempt * 600);
    return callGeminiOnce(url, body, attempt + 1);
  }

  return { response, text };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const expected = (process.env.GEMINI_PROXY_SECRET || "").trim();
  const provided = (
    event.headers["x-gemini-proxy-secret"] ||
    event.headers["X-Gemini-Proxy-Secret"] ||
    ""
  ).trim();

  if (!expected || provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }

  const apiKey = (
    process.env.GEMINI_PROXY_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
  const preferred = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  if (!apiKey) {
    return json(503, { error: "GEMINI_PROXY_API_KEY not configured on proxy" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!prompt.trim()) {
    return json(400, { error: "prompt is required" });
  }

  const parts = [];
  if (typeof payload.system === "string" && payload.system.trim()) {
    parts.push({ text: payload.system });
  }
  if (payload.image?.mimeType && payload.image?.base64) {
    parts.push({
      inline_data: {
        mime_type: payload.image.mimeType,
        data: payload.image.base64,
      },
    });
  }
  parts.push({ text: prompt });

  const requestBody = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature:
        typeof payload.temperature === "number" ? payload.temperature : 0.5,
      responseMimeType: "application/json",
    },
  };

  const models = modelChain(
    typeof payload.model === "string" && payload.model.trim()
      ? payload.model.trim()
      : preferred,
  );

  let lastStatus = 502;
  let lastDetail = "";
  const tried = [];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let upstreamResult;
    try {
      upstreamResult = await callGeminiOnce(url, requestBody);
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
      tried.push({ model, error: lastDetail });
      continue;
    }

    const { response, text } = upstreamResult;
    lastStatus = response.status;
    lastDetail = text.slice(0, 300);
    tried.push({ model, status: response.status });

    if (isQuotaStatus(response.status, text)) {
      console.warn(`[gemini-proxy] ${model} quota/rate-limited, trying next`);
      continue;
    }

    if (!response.ok) {
      // Non-quota failure on this model — try next only for 404 (unknown model).
      if (response.status === 404) {
        console.warn(`[gemini-proxy] ${model} not found, trying next`);
        continue;
      }
      return json(502, {
        error: "Gemini upstream error",
        status: response.status,
        detail: lastDetail,
        model,
      });
    }

    let upstream;
    try {
      upstream = JSON.parse(text);
    } catch {
      return json(502, { error: "Invalid Gemini response", model });
    }

    if (upstream?.promptFeedback?.blockReason) {
      return json(422, {
        error: "Gemini blocked the prompt",
        detail: upstream.promptFeedback.blockReason,
        model,
      });
    }

    const raw = upstream?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw.trim()) {
      return json(502, {
        error: "Gemini returned empty content",
        finishReason: upstream?.candidates?.[0]?.finishReason || null,
        model,
      });
    }

    if (model !== preferred) {
      console.warn(
        `[gemini-proxy] served via fallback model=${model} (preferred=${preferred})`,
      );
    }

    return json(200, {
      text: raw,
      model,
      usedFallback: model !== preferred,
    });
  }

  return json(502, {
    error: "Gemini upstream error",
    status: lastStatus,
    detail: lastDetail || "All models exhausted",
    tried,
  });
}
