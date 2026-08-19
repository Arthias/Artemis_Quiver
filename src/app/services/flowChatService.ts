export interface FlowFeedbackResult {
  refined: boolean;
  error?: string | null;
  strategy: {
    keywords: string[];
    locations: string[];
    exclude_keywords: string[];
    target_companies: string[];
    reasoning: string;
    [key: string]: unknown;
  };
}

/**
 * Calls Flow's own /api/strategy/feedback directly — Flow's backend does the
 * interpretation (including location-aware remote/hybrid/on-site reasoning),
 * no LLM call happens client-side in Quiver for this feature.
 */
export async function submitFlowFeedback(baseUrl: string, feedback: string): Promise<FlowFeedbackResult> {
  const res = await fetch(`${baseUrl}/api/strategy/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) throw new Error("Failed to submit feedback to Flow");
  return res.json();
}
