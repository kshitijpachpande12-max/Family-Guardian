// ================================================
// State Machine Unit Tests
// ================================================
// We test EVERY valid transition and EVERY invalid transition.
// If any of these fail, it means our payment flow has a bug
// that could lead to lost money or bypassed security.
//
// Run with: npm test
// ================================================

const { transition, PAYMENT_STATES, PAYMENT_EVENTS } = require('../src/lib/stateMachine');

describe('Payment State Machine', () => {

  // ======================
  // VALID TRANSITIONS
  // ======================
  describe('Valid transitions', () => {

    test('PENDING + SCORE_LOW → AUTO_APPROVED', () => {
      expect(transition(PAYMENT_STATES.PENDING, PAYMENT_EVENTS.SCORE_LOW))
        .toBe(PAYMENT_STATES.AUTO_APPROVED);
    });

    test('PENDING + SCORE_HIGH → HELD', () => {
      expect(transition(PAYMENT_STATES.PENDING, PAYMENT_EVENTS.SCORE_HIGH))
        .toBe(PAYMENT_STATES.HELD);
    });

    test('HELD + GUARDIAN_APPROVE → APPROVED', () => {
      expect(transition(PAYMENT_STATES.HELD, PAYMENT_EVENTS.GUARDIAN_APPROVE))
        .toBe(PAYMENT_STATES.APPROVED);
    });

    test('HELD + GUARDIAN_BLOCK → BLOCKED', () => {
      expect(transition(PAYMENT_STATES.HELD, PAYMENT_EVENTS.GUARDIAN_BLOCK))
        .toBe(PAYMENT_STATES.BLOCKED);
    });

    test('AUTO_APPROVED + PAYMENT_SUCCESS → COMPLETED', () => {
      expect(transition(PAYMENT_STATES.AUTO_APPROVED, PAYMENT_EVENTS.PAYMENT_SUCCESS))
        .toBe(PAYMENT_STATES.COMPLETED);
    });

    test('AUTO_APPROVED + PAYMENT_FAIL → FAILED', () => {
      expect(transition(PAYMENT_STATES.AUTO_APPROVED, PAYMENT_EVENTS.PAYMENT_FAIL))
        .toBe(PAYMENT_STATES.FAILED);
    });

    test('APPROVED + PAYMENT_SUCCESS → COMPLETED', () => {
      expect(transition(PAYMENT_STATES.APPROVED, PAYMENT_EVENTS.PAYMENT_SUCCESS))
        .toBe(PAYMENT_STATES.COMPLETED);
    });

    test('APPROVED + PAYMENT_FAIL → FAILED', () => {
      expect(transition(PAYMENT_STATES.APPROVED, PAYMENT_EVENTS.PAYMENT_FAIL))
        .toBe(PAYMENT_STATES.FAILED);
    });
  });

  // ======================
  // INVALID TRANSITIONS
  // ======================
  describe('Invalid transitions (should throw)', () => {

    test('Cannot approve a PENDING payment (must be scored first)', () => {
      expect(() => transition(PAYMENT_STATES.PENDING, PAYMENT_EVENTS.GUARDIAN_APPROVE))
        .toThrow('Invalid transition');
    });

    test('Cannot block a PENDING payment', () => {
      expect(() => transition(PAYMENT_STATES.PENDING, PAYMENT_EVENTS.GUARDIAN_BLOCK))
        .toThrow('Invalid transition');
    });

    test('Cannot score an already HELD payment', () => {
      expect(() => transition(PAYMENT_STATES.HELD, PAYMENT_EVENTS.SCORE_LOW))
        .toThrow('Invalid transition');
    });

    test('Cannot send payment directly from HELD (must approve first)', () => {
      expect(() => transition(PAYMENT_STATES.HELD, PAYMENT_EVENTS.PAYMENT_SUCCESS))
        .toThrow('Invalid transition');
    });

    test('Cannot approve an AUTO_APPROVED payment', () => {
      expect(() => transition(PAYMENT_STATES.AUTO_APPROVED, PAYMENT_EVENTS.GUARDIAN_APPROVE))
        .toThrow('Invalid transition');
    });
  });

  // ======================
  // TERMINAL STATES
  // ======================
  describe('Terminal states (no transitions allowed)', () => {

    const terminalStates = [
      PAYMENT_STATES.BLOCKED,
      PAYMENT_STATES.COMPLETED,
      PAYMENT_STATES.FAILED
    ];

    const allEvents = Object.values(PAYMENT_EVENTS);

    terminalStates.forEach(state => {
      allEvents.forEach(event => {
        test(`${state} + ${event} → throws (terminal state)`, () => {
          expect(() => transition(state, event))
            .toThrow('terminal state');
        });
      });
    });
  });

  // ======================
  // FULL FLOW SCENARIOS
  // ======================
  describe('Full payment flows', () => {

    test('Happy path: low-risk payment auto-completes', () => {
      let state = PAYMENT_STATES.PENDING;
      state = transition(state, PAYMENT_EVENTS.SCORE_LOW);
      expect(state).toBe(PAYMENT_STATES.AUTO_APPROVED);
      state = transition(state, PAYMENT_EVENTS.PAYMENT_SUCCESS);
      expect(state).toBe(PAYMENT_STATES.COMPLETED);
    });

    test('Scam blocked: high-risk → held → guardian blocks', () => {
      let state = PAYMENT_STATES.PENDING;
      state = transition(state, PAYMENT_EVENTS.SCORE_HIGH);
      expect(state).toBe(PAYMENT_STATES.HELD);
      state = transition(state, PAYMENT_EVENTS.GUARDIAN_BLOCK);
      expect(state).toBe(PAYMENT_STATES.BLOCKED);
    });

    test('Guardian approves: high-risk → held → approved → completed', () => {
      let state = PAYMENT_STATES.PENDING;
      state = transition(state, PAYMENT_EVENTS.SCORE_HIGH);
      expect(state).toBe(PAYMENT_STATES.HELD);
      state = transition(state, PAYMENT_EVENTS.GUARDIAN_APPROVE);
      expect(state).toBe(PAYMENT_STATES.APPROVED);
      state = transition(state, PAYMENT_EVENTS.PAYMENT_SUCCESS);
      expect(state).toBe(PAYMENT_STATES.COMPLETED);
    });

    test('Payment fails after approval', () => {
      let state = PAYMENT_STATES.PENDING;
      state = transition(state, PAYMENT_EVENTS.SCORE_HIGH);
      state = transition(state, PAYMENT_EVENTS.GUARDIAN_APPROVE);
      state = transition(state, PAYMENT_EVENTS.PAYMENT_FAIL);
      expect(state).toBe(PAYMENT_STATES.FAILED);
    });
  });
});
