// ================================================
// Google Gemini AI Risk Scorer
// ================================================
// Calls Google Gemini Flash to analyze payment context
// and semantic intent. Unlike rules (which only look for exact words),
// the LLM understands social engineering, fear, manufactured urgency,
// and manipulative context.
//
// Key features:
// - Uses Native JSON mode (`responseMimeType: "application/json"`)
// - Enforces a strict 5-second timeout via AbortController
// - Graceful degradation: returns fallback if API key is missing or fails
// ================================================

const SYSTEM_PROMPT = `You are a cybersecurity and anti-fraud expert specializing in protecting elderly and vulnerable individuals from financial scams.

Analyze the proposed payment from an older adult:
- Payee (recipient)
- Amount (USD)
- Senior's stated reason / note

Look for red flags common in elder fraud:
1. Impersonation (tech support, IRS, law enforcement, utility company, grandchild in trouble)
2. Social engineering (manufactured urgency, secrecy demands, fear tactics)
3. Suspicious payment methods (gift cards, wire transfers, crypto ATM)
4. Refund scams (fake overpayments requiring money sent back)
5. Lottery or sweepstakes advance fees ("you won millions, pay tax first")

You MUST respond strictly in valid JSON with this exact structure:
{
  "risk": <number between 0 and 100>,
  "risk_level": "<low | medium | high>",
  "scam_type": "<tech_support | family_impersonation | authority_threat | gift_card_scam | lottery_scam | advance_fee | none | suspicious_other>",
  "explanation": "<2-3 clear, gentle sentences in plain English explaining why this is safe OR why family should review it>"
}
`;

/**
 * Analyzes payment with Google Gemini API.
 *
 * @param {Object} payment - { payee, amount, reason }
 * @param {Object} options - { timeoutMs?: number, model?: string }
 * @returns {Promise<Object>} Structured risk assessment
 */
async function evaluateWithGemini(payment, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const timeoutMs = options.timeoutMs || 5000;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const userPrompt = `
Payment to evaluate:
- Recipient / Payee: "${payment.payee || 'Unknown'}"
- Amount: $${payment.amount}
- Senior's explanation / reason: "${payment.reason || 'None provided'}"

Provide your risk score and plain-language explanation as requested.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Empty response received from Gemini.');
    }

    const parsed = JSON.parse(rawText);

    // Validate and clamp parsed output
    const risk = typeof parsed.risk === 'number'
      ? Math.min(100, Math.max(0, parsed.risk))
      : 50;

    let riskLevel = parsed.risk_level;
    if (!['low', 'medium', 'high'].includes(riskLevel)) {
      riskLevel = risk >= 75 ? 'high' : risk >= 40 ? 'medium' : 'low';
    }

    return {
      risk,
      risk_level: riskLevel,
      scam_type: parsed.scam_type || 'none',
      explanation: parsed.explanation || 'AI analysis completed.',
      modelUsed: model,
      source: 'gemini'
    };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    const message = isTimeout ? `Gemini request timed out after ${timeoutMs}ms` : err.message;

    // Rethrow standard error for hybrid engine to catch and fall back
    const error = new Error(message);
    error.isTimeout = isTimeout;
    throw error;
  }
}

module.exports = {
  evaluateWithGemini
};
