/**
 * Merchant-facing AI error messages.
 * Never expose quota, billing, API keys, provider names, or infra details.
 */
export function merchantAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");

  // Quota / rate limits / provider outages → same generic copy for merchants.
  if (
    /quota|rate limit|429|RESOURCE_EXHAUSTED|not configured|GEMINI|generativelanguage|AI generation failed|502|503|504|network|timeout|ECONN|ENOTFOUND|aborted/i.test(
      raw,
    )
  ) {
    return "AI generation is temporarily unavailable. Please try again later.";
  }
  if (/blocked/i.test(raw)) {
    return "AI could not process that content. Try again with different product text.";
  }
  if (/invalid JSON|parse|empty content/i.test(raw)) {
    return "Something went wrong while generating. Please try again.";
  }
  if (raw.length > 160 || /api[_ ]?key|stack|shpss_|Bearer/i.test(raw)) {
    return "Something went wrong while generating. Please try again.";
  }
  return "Something went wrong while generating. Please try again.";
}

export const AI_NOT_CONFIGURED_MERCHANT =
  "AI generation is temporarily unavailable. Schema markup and browsing still work — please try again later.";
