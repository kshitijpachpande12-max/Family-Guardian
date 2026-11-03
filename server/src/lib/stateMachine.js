// ================================================
// Payment State Machine - Pure Business Logic
// ================================================
// A "state machine" means a payment can only be in ONE of these states,
// and can only move between states in specific, predefined ways.
// This prevents bugs like "approved a payment that was already blocked."
//
// Why a pure function? It has no side effects (no database, no API calls).
// You give it a current state + an event, it returns the new state or throws.
// This makes it VERY easy to test and reason about.
// ================================================

// All possible states a payment can be in
const PAYMENT_STATES = {
  PENDING: 'PENDING',           // Just submitted, not yet scored
  SCORED: 'SCORED',             // Risk engine has scored it
  AUTO_APPROVED: 'AUTO_APPROVED', // Low risk, no guardian needed
  HELD: 'HELD',                 // High risk, waiting for guardian
  APPROVED: 'APPROVED',         // Guardian approved it
  BLOCKED: 'BLOCKED',           // Guardian blocked it
  COMPLETED: 'COMPLETED',       // PayPal payment succeeded
  FAILED: 'FAILED'              // PayPal payment failed
};

// Events that cause state transitions
const PAYMENT_EVENTS = {
  SCORE_LOW: 'SCORE_LOW',       // Risk engine says low risk
  SCORE_HIGH: 'SCORE_HIGH',     // Risk engine says high risk
  GUARDIAN_APPROVE: 'GUARDIAN_APPROVE',
  GUARDIAN_BLOCK: 'GUARDIAN_BLOCK',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAIL: 'PAYMENT_FAIL'
};

// The transition table: { [currentState]: { [event]: nextState } }
// If a combination isn't listed, that transition is INVALID.
const TRANSITIONS = {
  [PAYMENT_STATES.PENDING]: {
    [PAYMENT_EVENTS.SCORE_LOW]: PAYMENT_STATES.AUTO_APPROVED,
    [PAYMENT_EVENTS.SCORE_HIGH]: PAYMENT_STATES.HELD
  },
  [PAYMENT_STATES.HELD]: {
    [PAYMENT_EVENTS.GUARDIAN_APPROVE]: PAYMENT_STATES.APPROVED,
    [PAYMENT_EVENTS.GUARDIAN_BLOCK]: PAYMENT_STATES.BLOCKED
  },
  [PAYMENT_STATES.AUTO_APPROVED]: {
    [PAYMENT_EVENTS.PAYMENT_SUCCESS]: PAYMENT_STATES.COMPLETED,
    [PAYMENT_EVENTS.PAYMENT_FAIL]: PAYMENT_STATES.FAILED
  },
  [PAYMENT_STATES.APPROVED]: {
    [PAYMENT_EVENTS.PAYMENT_SUCCESS]: PAYMENT_STATES.COMPLETED,
    [PAYMENT_EVENTS.PAYMENT_FAIL]: PAYMENT_STATES.FAILED
  }
  // BLOCKED, COMPLETED, FAILED are terminal states — no transitions out
};

/**
 * Attempt a state transition.
 * @param {string} currentState - The payment's current state
 * @param {string} event - The event that occurred
 * @returns {string} The new state
 * @throws {Error} If the transition is invalid
 */
function transition(currentState, event) {
  const stateTransitions = TRANSITIONS[currentState];

  if (!stateTransitions) {
    throw new Error(
      `No transitions allowed from state "${currentState}" — it is a terminal state.`
    );
  }

  const nextState = stateTransitions[event];

  if (!nextState) {
    throw new Error(
      `Invalid transition: cannot apply event "${event}" in state "${currentState}". ` +
      `Allowed events: [${Object.keys(stateTransitions).join(', ')}]`
    );
  }

  return nextState;
}

module.exports = {
  PAYMENT_STATES,
  PAYMENT_EVENTS,
  TRANSITIONS,
  transition
};
