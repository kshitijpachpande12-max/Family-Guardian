// ================================================
// Hybrid Risk Scoring Engine
// ================================================
// Combines deterministic heuristics (rules) with
// generative AI (Google Gemini Flash) using an ensemble
// pattern:
//
// 1. Both engines run concurrently via Promise.allSettled
// 2. Final Risk Score = max(RuleScore, GeminiScore)
// 3. If Gemini is down/times out, seamlessly fall back to rules
// 4. Applies threshold:
//    - Score >= 40: HELD (guardian alerted)
//    - Score < 40: AUTO_APPROVED (proceeds immediately)
// ================================================

const { evaluateRules } = require('./ruleScorer');
const { evaluateWithGemini } = require('./geminiScorer');
const { PAYMENT_EVENTS } = require('./stateMachine');

// Configurable threshold: payments with risk >= 40 are paused for guardian review
const HOLD_THRESHOLD = 40;

/**
 * Score a payment request using the hybrid engine.
 *
 * @param {Object} payment - { payee, amount, reason }
 * @param {Array} previousPayments - Past payments to detect new payees
 * @returns {Promise<Object>} Comprehensive scoring output
 */
async function scorePayment(payment, previousPayments = []) {
  // 1. Run deterministic rules (synchronous, instant)
  const rulePromise = Promise.resolve().then(() => evaluateRules(payment, previousPayments));

  // 2. Run Gemini LLM analysis (asynchronous, network call)
  const geminiPromise = evaluateWithGemini(payment);

  // Run both in parallel
  const [ruleResultOutcome, geminiResultOutcome] = await Promise.allSettled([
    rulePromise,
    geminiPromise
  ]);

  // Extract rule results (always succeeds unless bad input)
  const ruleResult = ruleResultOutcome.status === 'fulfilled'
    ? ruleResultOutcome.value
    : { score: 0, flags: ['rule_error'], reasons: [] };

  const allFlags = [...(ruleResult.flags || [])];
  let finalScore = ruleResult.score;
  let scamType = 'none';
  let plainExplanation = '';
  let geminiFailed = false;
  let geminiOutput = null;

  // Extract Gemini results or handle fallback
  if (geminiResultOutcome.status === 'fulfilled') {
    geminiOutput = geminiResultOutcome.value;
    // Conservative Max: take the highest alarm raised by either engine
    finalScore = Math.max(ruleResult.score, geminiOutput.risk);
    scamType = geminiOutput.scam_type;

    // Build rich, guardian-friendly plain-language explanation
    const ruleSummary = ruleResult.reasons.length > 0
      ? `System flags: ${ruleResult.reasons.join(' ')} `
      : '';
    plainExplanation = `${ruleSummary}${geminiOutput.explanation}`.trim();
  } else {
    // LLM failed, timed out, or no API key -> Graceful fallback
    geminiFailed = true;
    allFlags.push('gemini_fallback');

    if (ruleResult.flags.length > 0) {
      plainExplanation = `Flagged by security heuristics: ${ruleResult.reasons.join(' ')}`;
      scamType = ruleResult.flags[0];
    } else {
      plainExplanation = 'No known risk patterns detected. Standard transaction.';
    }
  }

  // Determine categorical risk level
  const riskLevel = finalScore >= 75 ? 'high' : finalScore >= HOLD_THRESHOLD ? 'medium' : 'low';

  // Determine state transition event
  const isHeld = finalScore >= HOLD_THRESHOLD;
  const event = isHeld ? PAYMENT_EVENTS.SCORE_HIGH : PAYMENT_EVENTS.SCORE_LOW;

  return {
    riskScore: finalScore,
    riskLevel,
    scamType,
    riskExplanation: plainExplanation,
    ruleFlags: allFlags,
    event,
    decision: isHeld ? 'HELD' : 'AUTO_APPROVED',
    breakdown: {
      ruleScore: ruleResult.score,
      geminiScore: geminiOutput ? geminiOutput.risk : null,
      geminiFallback: geminiFailed,
      isNewPayee: ruleResult.isNewPayee
    }
  };
}

module.exports = {
  HOLD_THRESHOLD,
  scorePayment
};
