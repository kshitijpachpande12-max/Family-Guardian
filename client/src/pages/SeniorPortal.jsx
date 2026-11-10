// ================================================
// Senior Portal - Accessible, Calming Elder Interface
// ================================================

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function SeniorPortal() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Payment Form State
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  const fetchPayments = async () => {
    try {
      const res = await api.get('/payments');
      setPayments(res.data.payments);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!payee || !amount || !reason) return;

    setSubmitting(true);
    setSubmissionResult(null);

    try {
      const res = await api.post('/payments', {
        payee,
        amount: Number(amount),
        reason
      });

      setSubmissionResult(res.data);
      // Reset form
      setPayee('');
      setAmount('');
      setReason('');
      fetchPayments();
    } catch (err) {
      console.error('Submission error:', err);
      alert(err.response?.data?.error || 'Failed to submit payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick-Fill Scenario presets for testing & hackathon demo video
  const handleQuickFill = (preset) => {
    setPayee(preset.payee);
    setAmount(preset.amount);
    setReason(preset.reason);
  };

  return (
    <div className="senior-portal">
      {/* Reassuring Welcome Header */}
      <header className="senior-header">
        <div className="senior-welcome">
          <h1>Good day, {user?.name || 'Friend'} 🌸</h1>
          <p className="senior-subtitle">
            Every payment you make is protected by your Family Guardian and verified before money leaves your account.
          </p>
        </div>

        <div className="senior-shield-card">
          <div className="shield-emblem">🛡️</div>
          <div>
            <h3>AI Protection Active</h3>
            <p>Your guardian is linked. You never have to worry about scam calls or trick websites.</p>
          </div>
        </div>
      </header>

      {/* Main Grid: Payment Form + Quick Demo Scenarios */}
      <div className="senior-grid">
        {/* Left: Accessible Payment Form */}
        <section className="senior-form-card">
          <h2>Make a Payment</h2>
          <p className="form-subtext">Fill in the details below. Our system will make sure it is safe.</p>

          {/* Quick-fill Scenario Pills */}
          <div className="scenario-pills">
            <span className="pills-label">⚡ Try a test scenario:</span>
            <div className="pills-container">
              <button
                type="button"
                onClick={() => handleQuickFill({
                  payee: 'County Court Bail Bondsman',
                  amount: '2200.00',
                  reason: 'Grandson was in a car accident and is in jail. Needs bail right now, do not tell his mom!'
                })}
                className="pill-btn pill-scam"
              >
                🚨 Scam: Grandson Bail ($2,200)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill({
                  payee: 'Geek Squad Tech Support',
                  amount: '499.00',
                  reason: 'Refund overpayment for antivirus renewal, please wire back difference via AnyDesk.'
                })}
                className="pill-btn pill-scam"
              >
                🚨 Scam: AnyDesk Refund ($499)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill({
                  payee: 'Duke Energy Utilities',
                  amount: '132.45',
                  reason: 'Monthly electric power bill for household.'
                })}
                className="pill-btn pill-legit"
              >
                ✅ Legit: Duke Energy ($132.45)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill({
                  payee: 'CVS Pharmacy #4821',
                  amount: '42.18',
                  reason: 'Heart and blood pressure prescription copay refill.'
                })}
                className="pill-btn pill-legit"
              >
                ✅ Legit: CVS Pharmacy ($42.18)
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="senior-payment-form">
            <div className="senior-input-group">
              <label htmlFor="payee">Who are you paying? (Company or Person)</label>
              <input
                id="payee"
                type="text"
                placeholder="e.g. Duke Energy, CVS, or County Bail"
                value={payee}
                onChange={e => setPayee(e.target.value)}
                required
              />
            </div>

            <div className="senior-input-group">
              <label htmlFor="amount">How much money? (USD $)</label>
              <div className="amount-input-wrapper">
                <span className="dollar-sign">$</span>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="senior-input-group">
              <label htmlFor="reason">What is this payment for? (Short note)</label>
              <textarea
                id="reason"
                rows="3"
                placeholder="e.g. Monthly electricity bill, or someone called me asking for money..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-senior-submit">
              {submitting ? '🛡️ Protecting & Checking Payment...' : '🛡️ Send Payment Safely'}
            </button>
          </form>

          {/* Submission Result Feedback Modal */}
          {submissionResult && (
            <div className={`result-banner ${submissionResult.payment.status === 'HELD' ? 'banner-held' : 'banner-approved'}`}>
              <div className="result-icon">
                {submissionResult.payment.status === 'HELD' ? '✋' : '✅'}
              </div>
              <div className="result-body">
                <h3>
                  {submissionResult.payment.status === 'HELD'
                    ? 'Payment Paused for Your Safety'
                    : 'Payment Verified & Approved!'}
                </h3>
                <p>
                  {submissionResult.payment.status === 'HELD'
                    ? `We noticed potential scam patterns in this payment to ${submissionResult.payment.payee}. We have held the $${submissionResult.payment.amount} and sent a message to your family guardian for review. No money was taken.`
                    : `Your payment of $${submissionResult.payment.amount} to ${submissionResult.payment.payee} was verified as low risk and disbursed safely via PayPal.`}
                </p>
                {submissionResult.payment.paypalOrderId && (
                  <p className="paypal-ref">PayPal Sandbox Order: <code>{submissionResult.payment.paypalOrderId}</code></p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right: Payment History */}
        <section className="senior-history-card">
          <h2>Your Recent Payments</h2>
          <p className="history-subtext">Everything you have paid or paused recently.</p>

          {loading ? (
            <p className="loading-state">Loading your transactions...</p>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <p>No payments submitted yet. Make your first payment above!</p>
            </div>
          ) : (
            <div className="payments-list">
              {payments.map(p => (
                <div key={p._id} className="payment-item">
                  <div className="payment-item-top">
                    <div>
                      <h4 className="payee-title">{p.payee}</h4>
                      <p className="payment-date">{new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div className="payment-amount">
                      ${Number(p.amount).toFixed(2)}
                    </div>
                  </div>

                  <p className="payment-reason">"{p.reason}"</p>

                  <div className="payment-item-bottom">
                    {p.status === 'COMPLETED' && (
                      <span className="status-badge badge-completed">✅ Paid Safely via PayPal</span>
                    )}
                    {p.status === 'HELD' && (
                      <span className="status-badge badge-held">✋ Paused — Waiting for Guardian</span>
                    )}
                    {p.status === 'BLOCKED' && (
                      <span className="status-badge badge-blocked">🛡️ Blocked Scam — Money Saved</span>
                    )}
                    {p.status === 'AUTO_APPROVED' && (
                      <span className="status-badge badge-completed">✅ Auto-Approved</span>
                    )}
                    {p.status === 'FAILED' && (
                      <span className="status-badge badge-failed">⚠️ Payment Failed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
