// ================================================
// Database Demo Seeder Script
// ================================================
// Prepopulates MongoDB with demo accounts and scenario payments:
// 1. Senior: Eleanor Vance (eleanor@guardian.demo / demo123)
// 2. Guardian: David Vance (david@guardian.demo / demo123, linked to Eleanor)
// 3. Seeded payment history (Completed legit, Blocked scam, Active HELD scam)
//
// Run with: npm run seed (in /server)
// ================================================

require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { PAYMENT_STATES } = require('../lib/stateMachine');

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/family-guardian';
  console.log('Connecting to MongoDB at:', uri.split('@')[1] || uri);
  await mongoose.connect(uri);

  console.log('Cleaning existing demo data...');
  const demoEmails = ['eleanor@guardian.demo', 'david@guardian.demo'];
  const existingUsers = await User.find({ email: { $in: demoEmails } });
  const userIds = existingUsers.map(u => u._id);

  await Payment.deleteMany({ senior: { $in: userIds } });
  await User.deleteMany({ email: { $in: demoEmails } });

  console.log('Creating demo users...');

  // 1. Create Senior (password will be hashed by pre-save hook)
  const senior = await User.create({
    name: 'Eleanor Vance',
    email: 'eleanor@guardian.demo',
    password: 'password123',
    role: 'senior'
  });

  // 2. Create Guardian linked to Senior
  const guardian = await User.create({
    name: 'David Vance',
    email: 'david@guardian.demo',
    password: 'password123',
    role: 'guardian',
    linkedSenior: senior._id
  });

  console.log(`✅ Senior created: ${senior.name} (${senior.email})`);
  console.log(`✅ Guardian created: ${guardian.name} (${guardian.email}) -> linked to Eleanor`);

  console.log('Seeding demo transactions...');

  // 3. Seed Payment 1: Legitimate routine payment (COMPLETED via PayPal)
  await Payment.create({
    senior: senior._id,
    payee: 'Duke Energy Utilities',
    amount: 132.45,
    reason: 'Monthly electric power bill for October.',
    status: PAYMENT_STATES.COMPLETED,
    riskScore: 0,
    riskLevel: 'low',
    riskExplanation: 'Standard household utility bill to verified regional power provider. Zero scam indicators detected.',
    ruleFlags: [],
    paypalOrderId: 'SB-ORD-DUKE-91823',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    auditLog: [
      {
        action: 'CREATED',
        fromState: 'NONE',
        toState: PAYMENT_STATES.PENDING,
        performedBy: senior._id,
        note: 'Payment of $132.45 to Duke Energy Utilities submitted.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        action: 'SCORED',
        fromState: PAYMENT_STATES.PENDING,
        toState: PAYMENT_STATES.AUTO_APPROVED,
        performedBy: senior._id,
        note: 'Scored 0/100 (low risk). AUTO_APPROVED. Standard household utility bill.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 500)
      },
      {
        action: 'PAYMENT_SUCCESS',
        fromState: PAYMENT_STATES.AUTO_APPROVED,
        toState: PAYMENT_STATES.COMPLETED,
        performedBy: senior._id,
        note: 'PayPal sandbox order SB-ORD-DUKE-91823 captured successfully.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1200)
      }
    ]
  });

  // 4. Seed Payment 2: High-risk scam that was BLOCKED by Guardian
  await Payment.create({
    senior: senior._id,
    payee: 'Geek Squad Tech Refund Center',
    amount: 499.00,
    reason: 'Accidental antivirus refund overpayment, must send back difference via AnyDesk.',
    status: PAYMENT_STATES.BLOCKED,
    riskScore: 95,
    riskLevel: 'high',
    scamType: 'tech_support_refund',
    riskExplanation: 'Classic tech-support overpayment refund scam. Requests reverse fund transfer using remote desktop software.',
    ruleFlags: ['tech_support_or_overpayment', 'urgency_or_secrecy'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
    auditLog: [
      {
        action: 'CREATED',
        fromState: 'NONE',
        toState: PAYMENT_STATES.PENDING,
        performedBy: senior._id,
        note: 'Payment of $499.00 submitted.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        action: 'SCORED',
        fromState: PAYMENT_STATES.PENDING,
        toState: PAYMENT_STATES.HELD,
        performedBy: senior._id,
        note: 'Scored 95/100 (high risk). HELD. Tech support overpayment detected.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 800)
      },
      {
        action: 'GUARDIAN_NOTIFIED',
        fromState: PAYMENT_STATES.HELD,
        toState: PAYMENT_STATES.HELD,
        performedBy: senior._id,
        note: 'Emergency alert email sent to david@guardian.demo.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 1100)
      },
      {
        action: 'GUARDIAN_BLOCK',
        fromState: PAYMENT_STATES.HELD,
        toState: PAYMENT_STATES.BLOCKED,
        performedBy: guardian._id,
        note: 'Guardian blocked transaction: "Mom, Geek Squad never calls or asks for refunds through AnyDesk!"',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000)
      }
    ]
  });

  // 5. Seed Payment 3: Active HELD scam ready for live demo in video!
  await Payment.create({
    senior: senior._id,
    payee: 'County Court Bail Bondsman',
    amount: 2200.00,
    reason: 'Grandson was in a car accident and is in jail. Needs bail right now, do not tell his mom!',
    status: PAYMENT_STATES.HELD,
    riskScore: 100,
    riskLevel: 'high',
    scamType: 'family_impersonation',
    riskExplanation: 'CRITICAL ALERT: Classic Grandparent Scam. Exploits fear and urgency regarding a relative in legal peril while explicitly enforcing secrecy.',
    ruleFlags: ['grandparent_scam', 'urgency_or_secrecy', 'authority_threat', 'high_amount_extreme'],
    createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
    auditLog: [
      {
        action: 'CREATED',
        fromState: 'NONE',
        toState: PAYMENT_STATES.PENDING,
        performedBy: senior._id,
        note: 'Payment of $2,200.00 submitted.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000)
      },
      {
        action: 'SCORED',
        fromState: PAYMENT_STATES.PENDING,
        toState: PAYMENT_STATES.HELD,
        performedBy: senior._id,
        note: 'Scored 100/100 (high risk). HELD for Guardian review.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000 + 700)
      },
      {
        action: 'GUARDIAN_NOTIFIED',
        fromState: PAYMENT_STATES.HELD,
        toState: PAYMENT_STATES.HELD,
        performedBy: senior._id,
        note: 'Emergency alert email sent to david@guardian.demo with 1-click action buttons.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000 + 1000)
      }
    ]
  });

  console.log('✅ Seeded 3 payments: 1 COMPLETED, 1 BLOCKED, 1 ACTIVE HELD SCAM');
  console.log('\n============================================================');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
  console.log('------------------------------------------------------------');
  console.log('Senior Account   : eleanor@guardian.demo | password123');
  console.log('Guardian Account : david@guardian.demo   | password123');
  console.log('============================================================\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
