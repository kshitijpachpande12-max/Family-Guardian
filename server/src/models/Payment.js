// ================================================
// Payment Model - Mongoose Schema
// ================================================
// This is the core of the whole app. Each document represents
// one payment request from a senior.
//
// Key design decisions:
// 1. "status" uses our state machine enum — only valid states allowed.
// 2. "idempotencyKey" prevents double payments (explained below).
// 3. "auditLog" is an embedded array — every state change is recorded
//    with who did it and when. This is critical for financial apps.
// ================================================

const mongoose = require('mongoose');
const { PAYMENT_STATES } = require('../lib/stateMachine');
const crypto = require('crypto');

// Sub-schema for audit log entries (embedded documents)
const auditEntrySchema = new mongoose.Schema({
  action: { type: String, required: true },       // e.g. "SCORED", "GUARDIAN_APPROVE"
  fromState: { type: String, required: true },     // state before
  toState: { type: String, required: true },       // state after
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who did it
  note: { type: String, default: '' },             // optional explanation
  timestamp: { type: Date, default: Date.now }
}, { _id: false });  // Don't create separate IDs for sub-documents

const paymentSchema = new mongoose.Schema({
  // --- Who is paying ---
  senior: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // --- Payment details ---
  payee: {
    type: String,
    required: [true, 'Payee name or email is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be positive']
  },
  reason: {
    type: String,
    required: [true, 'Reason for payment is required'],
    trim: true
  },

  // --- State machine status ---
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATES),
    default: PAYMENT_STATES.PENDING
  },

  // --- Risk scoring results ---
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', null],
    default: null
  },
  riskExplanation: {
    type: String,
    default: ''
  },
  scamType: {
    type: String,
    default: null
  },
  ruleFlags: {
    type: [String],   // e.g. ["high_amount", "urgency_keyword"]
    default: []
  },

  // --- Idempotency ---
  // "Idempotent" = doing the same thing twice has the same result as doing it once.
  // If a guardian double-clicks "Approve", or their browser retries, we use this
  // key to ensure PayPal only processes the payment ONCE.
  idempotencyKey: {
    type: String,
    unique: true,
    default: () => crypto.randomUUID()  // Auto-generate a UUID
  },

  // --- PayPal tracking ---
  paypalOrderId: {
    type: String,
    default: null
  },

  // --- Audit trail ---
  auditLog: {
    type: [auditEntrySchema],
    default: []
  }
}, {
  timestamps: true
});

// Index for quick lookups: "show me all payments for this senior"
paymentSchema.index({ senior: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
