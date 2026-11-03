// ================================================
// Payment Routes - Submit, List, Approve, Block
// ================================================
// POST   /api/payments          - Senior submits a payment request
// GET    /api/payments          - List payments (senior sees own, guardian sees linked)
// GET    /api/payments/:id      - Get one payment with full details
// POST   /api/payments/:id/approve - Guardian approves a held payment
// POST   /api/payments/:id/block   - Guardian blocks a held payment
// ================================================

const express = require('express');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { transition, PAYMENT_STATES, PAYMENT_EVENTS } = require('../lib/stateMachine');

const router = express.Router();

// All payment routes require authentication
router.use(authenticate);

// ---- POST /api/payments ---- (Senior only)
// Creates a new payment request in PENDING state.
// In Phase 2, this will also trigger risk scoring.
router.post('/', authorize('senior'), async (req, res) => {
  try {
    const { payee, amount, reason } = req.body;

    if (!payee || !amount || !reason) {
      return res.status(400).json({ error: 'Payee, amount, and reason are required.' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive.' });
    }

    const payment = await Payment.create({
      senior: req.user._id,
      payee,
      amount,
      reason,
      status: PAYMENT_STATES.PENDING,
      auditLog: [{
        action: 'CREATED',
        fromState: 'NONE',
        toState: PAYMENT_STATES.PENDING,
        performedBy: req.user._id,
        note: `Payment of $${amount} to ${payee} submitted.`
      }]
    });

    // TODO (Phase 2): Trigger risk scoring here
    // For now, we'll leave it in PENDING state

    res.status(201).json({
      message: 'Payment request submitted.',
      payment
    });
  } catch (err) {
    console.error('Payment creation error:', err);
    res.status(500).json({ error: 'Server error creating payment.' });
  }
});

// ---- GET /api/payments ---- (Both roles)
// Seniors see their own payments. Guardians see their linked senior's payments.
router.get('/', async (req, res) => {
  try {
    let query;

    if (req.user.role === 'senior') {
      // Senior sees their own payments
      query = { senior: req.user._id };
    } else {
      // Guardian sees payments from their linked senior
      if (!req.user.linkedSenior) {
        return res.status(400).json({ error: 'Guardian is not linked to any senior.' });
      }
      query = { senior: req.user.linkedSenior };
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })  // Newest first
      .populate('senior', 'name email');  // Include senior's name & email

    res.json({ payments });
  } catch (err) {
    console.error('Payment list error:', err);
    res.status(500).json({ error: 'Server error fetching payments.' });
  }
});

// ---- GET /api/payments/:id ---- (Both roles, with access check)
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('senior', 'name email')
      .populate('auditLog.performedBy', 'name email role');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    // Access check: senior can only see own payments, guardian can only see linked
    const canAccess =
      (req.user.role === 'senior' && payment.senior._id.equals(req.user._id)) ||
      (req.user.role === 'guardian' && payment.senior._id.equals(req.user.linkedSenior));

    if (!canAccess) {
      return res.status(403).json({ error: 'You do not have access to this payment.' });
    }

    res.json({ payment });
  } catch (err) {
    console.error('Payment detail error:', err);
    res.status(500).json({ error: 'Server error fetching payment.' });
  }
});

// ---- POST /api/payments/:id/approve ---- (Guardian only)
router.post('/:id/approve', authorize('guardian'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    // Security: Guardian can only approve payments for THEIR linked senior
    if (!payment.senior.equals(req.user.linkedSenior)) {
      return res.status(403).json({ error: 'You can only approve payments for your linked senior.' });
    }

    // --- Idempotency check ---
    // If the payment is already APPROVED or COMPLETED, return success (no double action)
    if (payment.status === PAYMENT_STATES.APPROVED ||
        payment.status === PAYMENT_STATES.COMPLETED) {
      return res.json({
        message: 'Payment was already approved.',
        payment
      });
    }

    // Use state machine to validate the transition
    const newState = transition(payment.status, PAYMENT_EVENTS.GUARDIAN_APPROVE);

    // Update payment
    payment.status = newState;
    payment.auditLog.push({
      action: 'GUARDIAN_APPROVE',
      fromState: PAYMENT_STATES.HELD,
      toState: newState,
      performedBy: req.user._id,
      note: req.body.note || 'Guardian approved this payment.'
    });

    await payment.save();

    // TODO (Phase 3): Trigger PayPal payment here

    res.json({
      message: 'Payment approved by guardian.',
      payment
    });
  } catch (err) {
    // State machine throws if transition is invalid
    if (err.message.includes('Invalid transition') || err.message.includes('terminal state')) {
      return res.status(409).json({ error: err.message });
    }
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Server error approving payment.' });
  }
});

// ---- POST /api/payments/:id/block ---- (Guardian only)
router.post('/:id/block', authorize('guardian'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    // Security: Guardian can only block payments for THEIR linked senior
    if (!payment.senior.equals(req.user.linkedSenior)) {
      return res.status(403).json({ error: 'You can only block payments for your linked senior.' });
    }

    // Idempotency: already blocked? Return success.
    if (payment.status === PAYMENT_STATES.BLOCKED) {
      return res.json({
        message: 'Payment was already blocked.',
        payment
      });
    }

    const newState = transition(payment.status, PAYMENT_EVENTS.GUARDIAN_BLOCK);

    payment.status = newState;
    payment.auditLog.push({
      action: 'GUARDIAN_BLOCK',
      fromState: PAYMENT_STATES.HELD,
      toState: newState,
      performedBy: req.user._id,
      note: req.body.note || 'Guardian blocked this payment.'
    });

    await payment.save();

    res.json({
      message: 'Payment blocked by guardian.',
      payment
    });
  } catch (err) {
    if (err.message.includes('Invalid transition') || err.message.includes('terminal state')) {
      return res.status(409).json({ error: err.message });
    }
    console.error('Block error:', err);
    res.status(500).json({ error: 'Server error blocking payment.' });
  }
});

module.exports = router;
