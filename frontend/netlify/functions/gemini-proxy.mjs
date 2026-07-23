/**
 * Gemini proxy for hosts in Google geo-blocked regions (e.g. some Render EU IPs).
 * Secrets: GEMINI_API_KEY, optional GEMINI_MODEL, GEMINI_PROXY_SECRET
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Proxy-Secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify(body),
  };
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

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  if (!apiKey) {
    return json(503, { error: "GEMINI_API_KEY not configured on proxy" });
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature:
          typeof payload.temperature === "number" ? payload.temperature : 0.5,
        responseMimeType: "application/json",
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    return json(502, {
      error: "Gemini upstream error",
      status: response.status,
      detail: text.slice(0, 300),
    });
  }

  let upstream;
  try {
    upstream = JSON.parse(text);
  } catch {
    return json(502, { error: "Invalid Gemini response" });
  }

  const raw =
    upstream?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return json(200, { text: raw });
}
