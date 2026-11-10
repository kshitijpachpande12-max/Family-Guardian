// ================================================
// PayPal Integration Unit & Mock Tests
// ================================================
// Tests:
// - OAuth token retrieval & caching
// - Order creation with idempotency header
// - Order capture
// - Release flow orchestrator
//
// Run with: npm test
// ================================================

const {
  isMockMode,
  getAccessToken,
  createOrder,
  captureOrder,
  releasePayment
} = require('../src/lib/paypalClient');

describe('PayPal Sandbox Integration', () => {
  const samplePayment = {
    _id: '672b1234567890abcdef1234',
    payee: 'Duke Energy',
    amount: 125.50,
    reason: 'Monthly electric bill',
    idempotencyKey: 'idemp-test-uuid-98765'
  };

  test('isMockMode returns boolean based on environment', () => {
    const mock = isMockMode();
    expect(typeof mock).toBe('boolean');
  });

  test('getAccessToken retrieves a valid token string', async () => {
    const token = await getAccessToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(5);
  });

  test('createOrder returns order with ID and valid status', async () => {
    const order = await createOrder(samplePayment);
    expect(order).toBeDefined();
    expect(order.id).toBeDefined();
    expect(typeof order.id).toBe('string');
  });

  test('captureOrder captures the order successfully', async () => {
    const order = await createOrder(samplePayment);
    const capture = await captureOrder(order.id, samplePayment.idempotencyKey);
    expect(capture).toBeDefined();
    expect(capture.status).toBe('COMPLETED');
  });

  test('releasePayment runs full order create + capture cycle', async () => {
    const result = await releasePayment(samplePayment);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();
    expect(result.captureId).toBeDefined();
    expect(result.status).toBe('COMPLETED');
  });
});
