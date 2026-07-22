/** Merchant-facing AI error messages (never expose .env or provider internals). */
export function merchantAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");

  if (/GEMINI_API_KEY|not configured/i.test(raw)) {
    return "AI generation is temporarily unavailable. Please try again later or contact support.";
  }
  if (/quota|rate limit|429/i.test(raw)) {
    return "AI is busy right now. Wait a moment and try again.";
  }
  if (/invalid JSON|parse/i.test(raw)) {
    return "AI returned an unexpected response. Please try again.";
  }
  if (/AI generation failed|generativelanguage|Gemini/i.test(raw)) {
    return "AI generation failed. Please try again in a moment.";
  }
  if (raw.length > 160 || /api[_ ]?key|stack|ECONN|ENOTFOUND/i.test(raw)) {
    return "Something went wrong while generating. Please try again.";
  }
  return raw || "Something went wrong. Please try again.";
}

export const AI_NOT_CONFIGURED_MERCHANT =
  "AI generation is temporarily unavailable. Schema markup and browsing still work — contact support if this continues.";
