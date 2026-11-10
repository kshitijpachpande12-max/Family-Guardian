// ================================================
// Payment Routes - Submit, List, Approve, Block & One-Click Email Actions
// ================================================
// GET    /api/payments/action   - Public signed one-click link from Guardian email
// POST   /api/payments          - Senior submits payment request (scores & auto-releases or holds)
// GET    /api/payments          - List payments (senior sees own, guardian sees linked)
// GET    /api/payments/:id      - Get single payment with full audit history
// POST   /api/payments/:id/approve - Guardian approves a held payment from dashboard
// POST   /api/payments/:id/block   - Guardian blocks a held payment from dashboard
// ================================================

const express = require('express');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { transition, PAYMENT_STATES, PAYMENT_EVENTS } = require('../lib/stateMachine');
const { scorePayment } = require('../lib/riskEngine');
const { releasePayment } = require('../lib/paypalClient');
const { verifyActionToken, sendGuardianAlert } = require('../lib/emailService');

const router = express.Router();

/**
 * Helper to render responsive HTML confirmation pages when guardian
 * clicks an emergency action button inside their email client.
 */
function renderActionHtml({ title, heading, message, statusType, details }) {
  const isBlock = statusType === 'block';
  const themeColor = isBlock ? '#dc2626' : '#10b981';
  const icon = isBlock ? '🛡️' : '✅';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #1f2937; margin: 0; padding: 24px; display: flex; justify-content: center; align-items: center; min-height: 90vh; }
    .card { background: #fff; max-width: 520px; width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: ${themeColor}; color: white; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 8px 0 0 0; font-size: 22px; }
    .content { padding: 24px; }
    .message { font-size: 16px; line-height: 1.5; color: #374151; margin-top: 0; }
    .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; }
    .box-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e5e7eb; }
    .box-row:last-child { border-bottom: none; }
    .btn { display: block; text-align: center; background: #1f2937; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; margin-top: 24px; }
    .btn:hover { background: #111827; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="font-size: 40px;">${icon}</div>
      <h1>${heading}</h1>
    </div>
    <div class="content">
      <p class="message">${message}</p>
      ${details ? `
      <div class="box">
        <div class="box-row"><span>Recipient:</span> <strong>${details.payee}</strong></div>
        <div class="box-row"><span>Amount:</span> <strong>$${Number(details.amount).toFixed(2)} USD</strong></div>
        <div class="box-row"><span>Status:</span> <strong style="color:${themeColor}">${details.status}</strong></div>
        ${details.paypalOrderId ? `<div class="box-row"><span>PayPal ID:</span> <code>${details.paypalOrderId}</code></div>` : ''}
      </div>` : ''}
      <a class="btn" href="${process.env.CLIENT_URL || 'http://localhost:5173'}">Open Family Guardian Dashboard</a>
    </div>
  </div>
</body>
</html>`;
}

// =========================================================================
// PUBLIC ROUTE: GET /api/payments/action (Signed 1-Click Action from Email)
// =========================================================================
router.get('/action', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send(renderActionHtml({
        title: 'Error',
        heading: 'Action Failed',
        message: 'No security action token was provided in the link.',
        statusType: 'block'
      }));
    }

    let payload;
    try {
      payload = verifyActionToken(token);
    } catch (tokenErr) {
      return res.status(401).send(renderActionHtml({
        title: 'Link Expired',
        heading: 'Link Expired or Invalid',
        message: 'This security link has expired or has already been used. Please log into the portal to review pending requests.',
        statusType: 'block'
      }));
    }

    const { paymentId, guardianId, action } = payload;
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).send(renderActionHtml({
        title: 'Not Found',
        heading: 'Payment Not Found',
        message: 'The requested payment was not found in the database.',
        statusType: 'block'
      }));
    }

    // --- IDEMPOTENCY CHECKS ---
    if (payment.status === PAYMENT_STATES.BLOCKED) {
      return res.send(renderActionHtml({
        title: 'Already Blocked',
        heading: 'Payment Was Already Blocked',
        message: 'This payment request was already blocked and cancelled. No funds were transferred.',
        statusType: 'block',
        details: payment
      }));
    }

    if (payment.status === PAYMENT_STATES.COMPLETED || payment.status === PAYMENT_STATES.APPROVED) {
      return res.send(renderActionHtml({
        title: 'Already Approved',
        heading: 'Payment Was Already Approved',
        message: 'This payment request was already verified and processed through PayPal Sandbox.',
        statusType: 'approve',
        details: payment
      }));
    }

    if (payment.status !== PAYMENT_STATES.HELD) {
      return res.status(409).send(renderActionHtml({
        title: 'Invalid State',
        heading: 'Cannot Change State',
        message: `This payment is currently in status "${payment.status}" and cannot be modified.`,
        statusType: 'block',
        details: payment
      }));
    }

    // --- EXECUTE ACTION ---
    if (action === 'block') {
      const nextState = transition(payment.status, PAYMENT_EVENTS.GUARDIAN_BLOCK);
      payment.status = nextState;
      payment.auditLog.push({
        action: 'GUARDIAN_BLOCK_ONECLICK',
        fromState: PAYMENT_STATES.HELD,
        toState: nextState,
        performedBy: guardianId,
        note: 'Guardian blocked this payment via one-click email emergency button.'
      });
      await payment.save();

      return res.send(renderActionHtml({
        title: 'Scam Blocked',
        heading: 'Scam Payment Blocked!',
        message: 'You successfully blocked this transaction. Your loved one’s money is safe and the payment rails were closed.',
        statusType: 'block',
        details: payment
      }));
    } else if (action === 'approve') {
      const approvedState = transition(payment.status, PAYMENT_EVENTS.GUARDIAN_APPROVE);
      payment.status = approvedState;
      payment.auditLog.push({
        action: 'GUARDIAN_APPROVE_ONECLICK',
        fromState: PAYMENT_STATES.HELD,
        toState: approvedState,
        performedBy: guardianId,
        note: 'Guardian approved payment via one-click email link.'
      });

      // Release PayPal order
      try {
        const paypalResult = await releasePayment(payment);
        const finalState = transition(payment.status, PAYMENT_EVENTS.PAYMENT_SUCCESS);
        payment.status = finalState;
        payment.paypalOrderId = paypalResult.orderId;
        payment.auditLog.push({
          action: 'PAYMENT_SUCCESS',
          fromState: PAYMENT_STATES.APPROVED,
          toState: finalState,
          performedBy: guardianId,
          note: `PayPal sandbox order ${paypalResult.orderId} captured via one-click release.`
        });
      } catch (paypalErr) {
        const failState = transition(payment.status, PAYMENT_EVENTS.PAYMENT_FAIL);
        payment.status = failState;
        payment.auditLog.push({
          action: 'PAYMENT_FAIL',
          fromState: PAYMENT_STATES.APPROVED,
          toState: failState,
          performedBy: guardianId,
          note: `PayPal release error: ${paypalErr.message}`
        });
      }

      await payment.save();

      return res.send(renderActionHtml({
        title: 'Payment Approved',
        heading: 'Payment Approved & Sent',
        message: 'You approved this payment. Funds have been released through PayPal Sandbox.',
        statusType: 'approve',
        details: payment
      }));
    } else {
      return res.status(400).send(renderActionHtml({
        title: 'Invalid Action',
        heading: 'Unknown Action',
        message: 'The requested action is not recognized by the system.',
        statusType: 'block'
      }));
    }
  } catch (err) {
    console.error('One-click action error:', err);
    res.status(500).send(renderActionHtml({
      title: 'Server Error',
      heading: 'Error Processing Action',
      message: 'A server error occurred while processing your request. Please try again.',
      statusType: 'block'
    }));
  }
});

// =========================================================================
// PROTECTED ROUTES: Require Session JWT Authentication
// =========================================================================
router.use(authenticate);

// ---- POST /api/payments ---- (Senior only)
// Creates a new payment request, scores risk, auto-releases or holds & alerts
router.post('/', authorize('senior'), async (req, res) => {
  try {
    const { payee, amount, reason } = req.body;

    if (!payee || !amount || !reason) {
      return res.status(400).json({ error: 'Payee, amount, and reason are required.' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive.' });
    }

    // 1. Create payment in PENDING state
    const payment = new Payment({
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

    // 2. Fetch past payment payees for this senior to detect new payees
    const pastPayments = await Payment.find({ senior: req.user._id })
      .select('payee')
      .lean();

    // 3. Evaluate risk using our Hybrid Scoring Engine (Rules + Gemini Flash)
    const scoring = await scorePayment(
      { payee, amount, reason },
      pastPayments
    );

    // 4. Transition state machine based on score (SCORE_LOW or SCORE_HIGH)
    const nextState = transition(payment.status, scoring.event);

    payment.status = nextState;
    payment.riskScore = scoring.riskScore;
    payment.riskLevel = scoring.riskLevel;
    payment.riskExplanation = scoring.riskExplanation;
    payment.scamType = scoring.scamType;
    payment.ruleFlags = scoring.ruleFlags;

    payment.auditLog.push({
      action: 'SCORED',
      fromState: PAYMENT_STATES.PENDING,
      toState: nextState,
      performedBy: req.user._id,
      note: `Scored ${scoring.riskScore}/100 (${scoring.riskLevel} risk). ${scoring.decision}. ${scoring.riskExplanation}`
    });

    // 5. If AUTO_APPROVED (low risk), immediately release payment via PayPal
    if (nextState === PAYMENT_STATES.AUTO_APPROVED) {
      try {
        const paypalResult = await releasePayment(payment);
        const finalState = transition(payment.status, PAYMENT_EVENTS.PAYMENT_SUCCESS);
        payment.status = finalState;
        payment.paypalOrderId = paypalResult.orderId;
        payment.auditLog.push({
          action: 'PAYMENT_SUCCESS',
          fromState: PAYMENT_STATES.AUTO_APPROVED,
          toState: finalState,
          performedBy: req.user._id,
          note: `PayPal sandbox order ${paypalResult.orderId} captured (${paypalResult.isMock ? 'simulator' : 'live-sandbox'}).`
        });
      } catch (paypalErr) {
        console.error('PayPal auto-release failed:', paypalErr);
        const failState = transition(payment.status, PAYMENT_EVENTS.PAYMENT_FAIL);
        payment.status = failState;
        payment.auditLog.push({
          action: 'PAYMENT_FAIL',
          fromState: PAYMENT_STATES.AUTO_APPROVED,
          toState: failState,
          performedBy: req.user._id,
          note: `PayPal sandbox release error: ${paypalErr.message}`
        });
      }
    }

    // 6. If HELD (elevated risk), send alert email with 1-click action links to guardian
    if (nextState === PAYMENT_STATES.HELD) {
      try {
        const guardian = await User.findOne({ linkedSenior: req.user._id, role: 'guardian' });
        if (guardian) {
          const emailOutcome = await sendGuardianAlert({
            senior: req.user,
            payment,
            guardian
          });
          payment.auditLog.push({
            action: 'GUARDIAN_NOTIFIED',
            fromState: PAYMENT_STATES.HELD,
            toState: PAYMENT_STATES.HELD,
            performedBy: req.user._id,
            note: `Notification sent to guardian ${guardian.email} (${emailOutcome.simulated ? 'simulator' : 'email sent'}).`
          });
        }
      } catch (notifyErr) {
        console.error('Guardian notification failed:', notifyErr);
        payment.auditLog.push({
          action: 'GUARDIAN_NOTIFY_ERROR',
          fromState: PAYMENT_STATES.HELD,
          toState: PAYMENT_STATES.HELD,
          performedBy: req.user._id,
          note: `Email alert failed: ${notifyErr.message}`
        });
      }
    }

    await payment.save();

    // Response includes status and plain-language explanation
    res.status(201).json({
      message: scoring.decision === 'HELD'
        ? 'Payment held for guardian review due to elevated risk.'
        : `Payment scored low risk and processed via PayPal (${payment.status}).`,
      payment,
      scoringDetails: scoring.breakdown
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
      query = { senior: req.user._id };
    } else {
      if (!req.user.linkedSenior) {
        return res.status(400).json({ error: 'Guardian is not linked to any senior.' });
      }
      query = { senior: req.user.linkedSenior };
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .populate('senior', 'name email');

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

// ---- POST /api/payments/:id/approve ---- (Guardian only from dashboard)
router.post('/:id/approve', authorize('guardian'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    if (!payment.senior.equals(req.user.linkedSenior)) {
      return res.status(403).json({ error: 'You can only approve payments for your linked senior.' });
    }

    if (payment.status === PAYMENT_STATES.APPROVED || payment.status === PAYMENT_STATES.COMPLETED) {
      return res.json({
        message: 'Payment was already approved.',
        payment
      });
    }

    const newState = transition(payment.status, PAYMENT_EVENTS.GUARDIAN_APPROVE);

    payment.status = newState;
    payment.auditLog.push({
      action: 'GUARDIAN_APPROVE',
      fromState: PAYMENT_STATES.HELD,
      toState: newState,
      performedBy: req.user._id,
      note: req.body.note || 'Guardian approved this payment.'
    });

    try {
      const paypalResult = await releasePayment(payment);
      const finalState = transition(payment.status, PAYMENT_EVENTS.PAYMENT_SUCCESS);
      payment.status = finalState;
      payment.paypalOrderId = paypalResult.orderId;
      payment.auditLog.push({
        action: 'PAYMENT_SUCCESS',
        fromState: PAYMENT_STATES.APPROVED,
        toState: finalState,
        performedBy: req.user._id,
        note: `Guardian approved. PayPal sandbox order ${paypalResult.orderId} captured (${paypalResult.isMock ? 'simulator' : 'live-sandbox'}).`
      });
    } catch (paypalErr) {
      console.error('PayPal release on approval failed:', paypalErr);
      const failState = transition(payment.status, PAYMENT_EVENTS.PAYMENT_FAIL);
      payment.status = failState;
      payment.auditLog.push({
        action: 'PAYMENT_FAIL',
        fromState: PAYMENT_STATES.APPROVED,
        toState: failState,
        performedBy: req.user._id,
        note: `PayPal release failed: ${paypalErr.message}`
      });
    }

    await payment.save();

    res.json({
      message: payment.status === PAYMENT_STATES.COMPLETED
        ? 'Payment approved and funds successfully disbursed via PayPal.'
        : 'Payment approved by guardian, but PayPal transfer failed.',
      payment
    });
  } catch (err) {
    if (err.message.includes('Invalid transition') || err.message.includes('terminal state')) {
      return res.status(409).json({ error: err.message });
    }
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Server error approving payment.' });
  }
});

// ---- POST /api/payments/:id/block ---- (Guardian only from dashboard)
router.post('/:id/block', authorize('guardian'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    if (!payment.senior.equals(req.user.linkedSenior)) {
      return res.status(403).json({ error: 'You can only block payments for your linked senior.' });
    }

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
