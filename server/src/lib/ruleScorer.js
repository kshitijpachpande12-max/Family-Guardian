// ================================================
// Rule-Based Risk Scorer
// ================================================
// Deterministic heuristics designed specifically to catch
// known financial scam patterns targeting older adults.
//
// Rules don't guess — they look for explicit red flags:
// 1. Scam payment instruments (gift cards, crypto, wire services)
// 2. High-pressure urgency & secrecy ("don't tell family", "immediately")
// 3. Fake authority & tech support ("IRS", "arrest", "AnyDesk", "refund")
// 4. Family emergency impersonation ("in jail", "bail money", "accident")
// 5. Unusually high amounts (single payment > $500, extreme > $1500)
// 6. First-time payee indicator
// ================================================

// High-confidence scam keywords grouped by category
const SCAM_PATTERNS = {
  GIFT_CARD_OR_CRYPTO: {
    weight: 85,
    flag: 'scam_payment_method',
    regex: /\b(gift\s*card|apple\s*gift|target\s*card|steam\s*card|google\s*play\s*card|bitcoin|crypto|crypto\s*atm|western\s*union|moneygram)\b/i,
    description: 'Requests payment via gift card, crypto, or untraceable wire.'
  },
  URGENCY_AND_SECRECY: {
    weight: 45,
    flag: 'urgency_or_secrecy',
    regex: /\b(immediately|right\s*now|(don'?t|do\s+not)\s*tell(\s+(anyone|family|kids|children|daughter|son|parents|mom|dad))?|keep\s*this\s*(a\s*)?secret|hurry|urgent|emergency|within\s*(\d+|an)\s*hour)\b/i,
    description: 'Uses urgency or asks to hide the payment from family members.'
  },
  LEGAL_OR_POLICE_THREAT: {
    weight: 75,
    flag: 'authority_threat',
    regex: /\b(irs|fbi|police|sheriff|arrest|warrant|lawsuit|jail|court\s*order|legal\s*action|frozen\s*account)\b/i,
    description: 'Threatens legal action, arrest, or claims to be government/police.'
  },
  TECH_SUPPORT_OR_REFUND: {
    weight: 70,
    flag: 'tech_support_or_overpayment',
    regex: /\b(microsoft\s*support|apple\s*support|geek\s*squad|anydesk|teamviewer|antivirus\s*renewal|refund\s*overpayment|security\s*breach|virus\s*detected)\b/i,
    description: 'Claims remote tech support, antivirus fee, or accidental refund overpayment.'
  },
  FAMILY_IMPERSONATION: {
    weight: 65,
    flag: 'grandparent_scam',
    regex: /\b(bail\s*money|need\s*bail|in\s*jail|car\s*accident|stranded|lost\s*my\s*phone|grandson|granddaughter|kidnapped)\b/i,
    description: 'Appears to impersonate a relative stranded or in legal trouble.'
  }
};

/**
 * Evaluates payment request against deterministic rule set.
 *
 * @param {Object} payment - { amount, payee, reason }
 * @param {Array} previousPayments - Past payments by this senior (optional)
 * @returns {Object} { score: number (0-100), flags: string[], reasons: string[], isNewPayee: boolean }
 */
function evaluateRules(payment, previousPayments = []) {
  const flags = [];
  const reasons = [];
  let score = 0;

  const combinedText = `${payment.payee || ''} ${payment.reason || ''}`;

  // 1. Scan text for known scam patterns
  for (const [key, pattern] of Object.entries(SCAM_PATTERNS)) {
    if (pattern.regex.test(combinedText)) {
      flags.push(pattern.flag);
      reasons.push(pattern.description);
      score += pattern.weight;
    }
  }

  // 2. Amount-based heuristic checks
  const amount = Number(payment.amount) || 0;
  if (amount >= 1500) {
    flags.push('high_amount_extreme');
    reasons.push('Amount exceeds $1,500 threshold for unverified transfers.');
    score += 40;
  } else if (amount >= 500) {
    flags.push('high_amount_moderate');
    reasons.push('Amount exceeds $500 threshold.');
    score += 20;
  }

  // 3. New payee heuristic
  const isNewPayee = previousPayments.length > 0
    ? !previousPayments.some(p => p.payee && p.payee.toLowerCase().trim() === (payment.payee || '').toLowerCase().trim())
    : true; // If no history, it's considered first-time

  if (isNewPayee && previousPayments.length > 0) {
    flags.push('new_payee');
    reasons.push('Recipient has never been paid by this senior before.');
    score += 15;
  }

  // Cap score between 0 and 100
  const normalizedScore = Math.min(100, Math.max(0, score));

  return {
    score: normalizedScore,
    flags,
    reasons,
    isNewPayee
  };
}

module.exports = {
  SCAM_PATTERNS,
  evaluateRules
};
