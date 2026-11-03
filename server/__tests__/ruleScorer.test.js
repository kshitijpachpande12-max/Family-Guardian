// ================================================
// Rule Scorer Unit Tests
// ================================================
// Tests deterministic pattern matching for elder fraud:
// - Gift cards, Crypto, Wire
// - High urgency / secrecy
// - Tech support & refund overpayment
// - Impersonation of authority & family
// - Benign daily transactions
//
// Run with: npm test
// ================================================

const { evaluateRules } = require('../src/lib/ruleScorer');

describe('Rule-Based Risk Scorer', () => {

  describe('Scam pattern detection', () => {
    test('Flags gift card payment request with high score', () => {
      const payment = {
        payee: 'Power Department Utility',
        amount: 300,
        reason: 'Pay power bill immediately with Apple gift card codes'
      };
      const result = evaluateRules(payment);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.flags).toContain('scam_payment_method');
      expect(result.flags).toContain('urgency_or_secrecy');
    });

    test('Flags crypto ATM / Bitcoin demands', () => {
      const payment = {
        payee: 'Vault Security',
        amount: 1000,
        reason: 'Deposit into Bitcoin ATM to protect account'
      };
      const result = evaluateRules(payment);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.flags).toContain('scam_payment_method');
    });

    test('Flags IRS arrest warrant threats', () => {
      const payment = {
        payee: 'IRS Enforcement',
        amount: 900,
        reason: 'Outstanding tax warrant, arrest warrant pending'
      };
      const result = evaluateRules(payment);
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.flags).toContain('authority_threat');
    });

    test('Flags tech support & AnyDesk remote software', () => {
      const payment = {
        payee: 'Geek Squad',
        amount: 450,
        reason: 'Refund overpayment fee for antivirus renewal via AnyDesk'
      };
      const result = evaluateRules(payment);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.flags).toContain('tech_support_or_overpayment');
    });

    test('Flags grandparent bail scam with secrecy', () => {
      const payment = {
        payee: 'Bail Bonds',
        amount: 800,
        reason: 'Grandson in jail after car accident, do not tell anyone'
      };
      const result = evaluateRules(payment);
      expect(result.score).toBeGreaterThanOrEqual(65);
      expect(result.flags).toContain('grandparent_scam');
      expect(result.flags).toContain('urgency_or_secrecy');
    });
  });

  describe('Amount-based heuristics', () => {
    test('Adds penalty for amounts exceeding $1,500', () => {
      const payment = {
        payee: 'Unknown Contractor',
        amount: 2500,
        reason: 'Roof repair deposit'
      };
      const result = evaluateRules(payment);
      expect(result.flags).toContain('high_amount_extreme');
      expect(result.score).toBeGreaterThanOrEqual(40);
    });

    test('Adds moderate penalty for amounts between $500 and $1499', () => {
      const payment = {
        payee: 'Furniture Store',
        amount: 750,
        reason: 'New recliner chair'
      };
      const result = evaluateRules(payment);
      expect(result.flags).toContain('high_amount_moderate');
      expect(result.score).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Legitimate payments (low score)', () => {
    test('Assigns low score to routine utility bill', () => {
      const payment = {
        payee: 'Duke Energy',
        amount: 112.50,
        reason: 'Monthly electric bill'
      };
      const history = [{ payee: 'Duke Energy' }];
      const result = evaluateRules(payment, history);
      expect(result.score).toBeLessThan(40);
      expect(result.flags).toHaveLength(0);
    });

    test('Assigns low score to pharmacy copay', () => {
      const payment = {
        payee: 'CVS Pharmacy',
        amount: 35.00,
        reason: 'Prescription heart medicine copay'
      };
      const history = [{ payee: 'CVS Pharmacy' }];
      const result = evaluateRules(payment, history);
      expect(result.score).toBeLessThan(40);
      expect(result.flags).toHaveLength(0);
    });
  });

});
