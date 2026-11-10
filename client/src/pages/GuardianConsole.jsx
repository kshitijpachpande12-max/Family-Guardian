// ================================================
// Guardian Security Console - Cyber-Fintech Defense Interface
// ================================================

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function GuardianConsole() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedAuditPayment, setSelectedAuditPayment] = useState(null);
  const [filter, setFilter] = useState('ALL'); // ALL, HELD, COMPLETED, BLOCKED

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

  const handleApprove = async (paymentId) => {
    if (!confirm('Are you sure you want to approve this payment and release funds via PayPal?')) return;
    setActionLoading(paymentId);
    try {
      await api.post(`/payments/${paymentId}/approve`, {
        note: 'Guardian approved payment from Security Console.'
      });
      fetchPayments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve payment.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (paymentId) => {
    if (!confirm('Are you sure you want to BLOCK this payment as a scam?')) return;
    setActionLoading(paymentId);
    try {
      await api.post(`/payments/${paymentId}/block`, {
        note: 'Guardian confirmed scam and blocked transaction.'
      });
      fetchPayments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to block payment.');
    } finally {
      setActionLoading(null);
    }
  };

  // Metrics calculations
  const heldPayments = payments.filter(p => p.status === 'HELD');
  const blockedPayments = payments.filter(p => p.status === 'BLOCKED');
  const completedPayments = payments.filter(p => p.status === 'COMPLETED');

  const moneySaved = blockedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const moneyDisbursed = completedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const filteredPayments = payments.filter(p => {
    if (filter === 'HELD') return p.status === 'HELD';
    if (filter === 'COMPLETED') return p.status === 'COMPLETED';
    if (filter === 'BLOCKED') return p.status === 'BLOCKED';
    return true;
  });

  return (
    <div className="guardian-console">
      {/* Console Top Header */}
      <header className="console-header">
        <div>
          <div className="console-tag">🛡️ GUARDIAN SENTINEL • CYBER-DEFENSE OPERATIONS</div>
          <h1>Security Monitoring Console</h1>
          <p className="console-subtext">
            Active oversight for protected senior: <strong>Eleanor Vance</strong>
          </p>
        </div>

        {/* Telemetry Metrics */}
        <div className="metrics-strip">
          <div className="metric-box metric-alert">
            <span className="metric-label">Active Threats</span>
            <span className="metric-val">{heldPayments.length} HELD</span>
          </div>
          <div className="metric-box metric-saved">
            <span className="metric-label">Elder Money Saved</span>
            <span className="metric-val">${moneySaved.toFixed(2)}</span>
          </div>
          <div className="metric-box metric-paypal">
            <span className="metric-label">PayPal Disbursed</span>
            <span className="metric-val">${moneyDisbursed.toFixed(2)}</span>
          </div>
        </div>
      </header>

      {/* URGENT ALERTS SECTION (Active HELD Payments) */}
      {heldPayments.length > 0 && (
        <section className="threats-section">
          <div className="section-title-row">
            <span className="pulse-dot"></span>
            <h2>🚨 Urgent Intervention Required ({heldPayments.length})</h2>
          </div>

          <div className="threat-cards-grid">
            {heldPayments.map(p => (
              <div key={p._id} className="threat-card">
                <div className="threat-card-top">
                  <div className="threat-header-left">
                    <span className="scam-type-pill">
                      {(p.scamType || 'SUSPICIOUS TRANSACTION').replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <h3 className="threat-payee">{p.payee}</h3>
                    <p className="threat-date">Requested {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="threat-score-dial">
                    <div className="score-number">{p.riskScore}</div>
                    <div className="score-max">/100</div>
                    <div className="score-label">CRITICAL</div>
                  </div>
                </div>

                <div className="threat-amount-row">
                  <span className="amount-label">Requested Transfer:</span>
                  <span className="amount-val">${Number(p.amount).toFixed(2)} USD</span>
                </div>

                <div className="threat-reason-box">
                  <strong>Senior's Stated Reason:</strong>
                  <p>"{p.reason}"</p>
                </div>

                {/* Red Flags Badges */}
                <div className="flags-list">
                  {(p.ruleFlags || []).map(flag => (
                    <span key={flag} className="flag-chip">
                      ⚠️ {flag.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ))}
                </div>

                {/* Gemini AI Reasoning Box */}
                <div className="gemini-reasoning-card">
                  <div className="gemini-header">
                    <span>✨ Google Gemini AI Fraud Analysis</span>
                  </div>
                  <p className="gemini-text">{p.riskExplanation || 'Elevated risk detected across heuristics.'}</p>
                </div>

                {/* Action Controls */}
                <div className="threat-actions">
                  <button
                    onClick={() => handleBlock(p._id)}
                    disabled={actionLoading === p._id}
                    className="btn-threat-block"
                  >
                    {actionLoading === p._id ? 'Processing...' : '🚨 BLOCK THIS SCAM'}
                  </button>
                  <button
                    onClick={() => handleApprove(p._id)}
                    disabled={actionLoading === p._id}
                    className="btn-threat-approve"
                  >
                    {actionLoading === p._id ? 'Releasing PayPal...' : '✅ APPROVE PAYMENT'}
                  </button>
                  <button
                    onClick={() => setSelectedAuditPayment(p)}
                    className="btn-threat-audit"
                  >
                    📜 Audit Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILTER TABS & ALL PAYMENTS TABLE */}
      <section className="history-section">
        <div className="table-header-row">
          <h2>Protected Payment Ledger</h2>
          <div className="filter-tabs">
            {['ALL', 'HELD', 'COMPLETED', 'BLOCKED'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`tab-btn ${filter === tab ? 'active-tab' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading ledger...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state">No transactions match this filter.</div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Recipient / Payee</th>
                  <th>Amount</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                  <th>PayPal Sandbox Ref</th>
                  <th>Audit Trail</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(p => (
                  <tr key={p._id}>
                    <td>{new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <strong>{p.payee}</strong>
                      <div className="table-reason-snippet">{p.reason}</div>
                    </td>
                    <td className="table-amount">${Number(p.amount).toFixed(2)}</td>
                    <td>
                      <span className={`risk-tag risk-${p.riskLevel || 'low'}`}>
                        {p.riskScore ?? 0}/100 {p.riskLevel ? p.riskLevel.toUpperCase() : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill pill-${p.status.toLowerCase()}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      {p.paypalOrderId ? (
                        <code className="paypal-code">{p.paypalOrderId}</code>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedAuditPayment(p)}
                        className="btn-view-audit"
                      >
                        Inspect ({p.auditLog?.length || 0})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AUDIT LOG MODAL DRAWER */}
      {selectedAuditPayment && (
        <div className="modal-backdrop" onClick={() => setSelectedAuditPayment(null)}>
          <div className="audit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>📜 Immutable Audit Trail</h3>
                <p>Transaction: <strong>{selectedAuditPayment.payee}</strong> (${Number(selectedAuditPayment.amount).toFixed(2)})</p>
              </div>
              <button onClick={() => setSelectedAuditPayment(null)} className="btn-close-modal">×</button>
            </div>

            <div className="audit-timeline">
              {(selectedAuditPayment.auditLog || []).map((entry, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-action">{entry.action}</span>
                      <span className="timeline-state">{entry.fromState} → {entry.toState}</span>
                      <span className="timeline-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="timeline-note">{entry.note}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <span className="idempotency-display">
                Idempotency Key: <code>{selectedAuditPayment.idempotencyKey}</code>
              </span>
              <button onClick={() => setSelectedAuditPayment(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
