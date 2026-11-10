// ================================================
// Guardian Email & Action Token Unit Tests
// ================================================
// Tests:
// - Cryptographic action token generation & verification
// - Tamper detection (invalid signature)
// - One-click approval / block URL formatting
// - Nodemailer / Mailtrap fallback handling
//
// Run with: npm test
// ================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars';

const {
  generateActionToken,
  verifyActionToken,
  sendGuardianAlert
} = require('../src/lib/emailService');

describe('Guardian Email & Action Link System', () => {
  const mockPaymentId = '672b1234567890abcdef1234';
  const mockGuardianId = '672b1234567890abcdef5678';

  describe('Signed Action Tokens', () => {
    test('Generates valid signed JWT for approve action', () => {
      const token = generateActionToken(mockPaymentId, mockGuardianId, 'approve');
      expect(typeof token).toBe('string');

      const decoded = verifyActionToken(token);
      expect(decoded.paymentId).toBe(mockPaymentId);
      expect(decoded.guardianId).toBe(mockGuardianId);
      expect(decoded.action).toBe('approve');
      expect(decoded.purpose).toBe('guardian_action');
    });

    test('Generates valid signed JWT for block action', () => {
      const token = generateActionToken(mockPaymentId, mockGuardianId, 'block');
      const decoded = verifyActionToken(token);
      expect(decoded.action).toBe('block');
    });

    test('Rejects tampered tokens', () => {
      const token = generateActionToken(mockPaymentId, mockGuardianId, 'block');
      const tampered = token.slice(0, -6) + 'xxxxxx';
      expect(() => verifyActionToken(tampered)).toThrow();
    });
  });

  describe('Guardian Alert Dispatcher', () => {
    test('Builds alert and returns working action URLs', async () => {
      const senior = { name: 'Eleanor Vance', email: 'eleanor@example.com' };
      const guardian = { _id: mockGuardianId, name: 'David Vance', email: 'david@example.com' };
      const payment = {
        _id: mockPaymentId,
        payee: 'Geek Squad Renewal',
        amount: 499.00,
        reason: 'Antivirus refund overpayment via AnyDesk',
        riskScore: 95,
        riskLevel: 'high',
        ruleFlags: ['tech_support_or_overpayment', 'urgency_or_secrecy'],
        riskExplanation: 'Unsolicited refund demand requesting remote desktop access.'
      };

      const result = await sendGuardianAlert({ senior, payment, guardian });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.approveUrl).toContain('/api/payments/action?token=');
      expect(result.blockUrl).toContain('/api/payments/action?token=');

      // Verify that URL tokens are valid
      const approveToken = result.approveUrl.split('token=')[1];
      const decodedApprove = verifyActionToken(approveToken);
      expect(decodedApprove.action).toBe('approve');

      const blockToken = result.blockUrl.split('token=')[1];
      const decodedBlock = verifyActionToken(blockToken);
      expect(decodedBlock.action).toBe('block');
    });
  });
});
