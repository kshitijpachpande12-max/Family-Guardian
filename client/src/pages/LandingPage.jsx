// ================================================
// Landing Page with Dual Portal Selector
// ================================================

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, quickDemoLogin } = useAuth();

  const handleDemoStart = async (role) => {
    try {
      const loggedUser = await quickDemoLogin(role);
      if (loggedUser.role === 'senior') {
        navigate('/senior');
      } else {
        navigate('/guardian');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      navigate('/login');
    }
  };

  return (
    <div className="landing-page">
      {/* Hero Header */}
      <header className="hero-section">
        <div className="hero-badge">🏆 PayPal AI Hackathon 2026 Project</div>
        <h1 className="hero-title">
          Financial Protection for the Ones Who Protected You.
        </h1>
        <p className="hero-subtitle">
          Older adults lose billions to high-pressure scams before family finds out.
          <strong> Family Guardian</strong> inserts an AI safety net: suspicious payments are held,
          plain-language warnings are sent to family, and funds only move via PayPal with guardian approval.
        </p>

        {/* 1-Click Hackathon Evaluator Bar */}
        <div className="evaluator-card">
          <div className="evaluator-header">
            <span className="sparkle">⚡</span>
            <span><strong>Hackathon Judges & Evaluators:</strong> 1-Click Instant Demo Experience</span>
          </div>
          <div className="evaluator-actions">
            <button
              onClick={() => handleDemoStart('senior')}
              className="btn-evaluator btn-eval-senior"
            >
              👵 Enter Senior Portal (Eleanor)
            </button>
            <button
              onClick={() => handleDemoStart('guardian')}
              className="btn-evaluator btn-eval-guardian"
            >
              🛡️ Enter Guardian Console (David)
            </button>
          </div>
          <p className="evaluator-hint">
            Pre-seeded with real elder-fraud scenarios (Grandparent scam, Geek Squad refund, utility bills). Zero typing required.
          </p>
        </div>
      </header>

      {/* Dual Portal Selection Cards */}
      <section className="portals-section">
        <div className="portal-card senior-card">
          <div className="portal-icon">👵</div>
          <h2>Senior Portal</h2>
          <p className="portal-desc">
            Designed for elderly users. High-contrast typography, soothing color palette,
            and gentle reassurance that every payment is protected by family.
          </p>
          <ul className="portal-features">
            <li>✓ Large, readable text & zero confusing jargon</li>
            <li>✓ Payments paused safely if a scam is suspected</li>
            <li>✓ Legitimate bills auto-approved instantly</li>
          </ul>
          <button
            onClick={() => handleDemoStart('senior')}
            className="portal-cta cta-senior"
          >
            Launch Senior Portal →
          </button>
        </div>

        <div className="portal-card guardian-card">
          <div className="portal-icon">🛡️</div>
          <h2>Guardian Sentinel</h2>
          <p className="portal-desc">
            A high-visibility security console for adult children and caregivers.
            Review AI risk scores, scam patterns, and release payments in one click.
          </p>
          <ul className="portal-features">
            <li>✓ Google Gemini Flash plain-language explanations</li>
            <li>✓ 1-Click Emergency Block & Approve links</li>
            <li>✓ Direct PayPal Sandbox order & capture tracking</li>
          </ul>
          <button
            onClick={() => handleDemoStart('guardian')}
            className="portal-cta cta-guardian"
          >
            Launch Security Console →
          </button>
        </div>
      </section>

      {/* Architecture Flow Banner */}
      <section className="architecture-strip">
        <h3>How Family Guardian Works (End-to-End)</h3>
        <div className="flow-steps">
          <div className="flow-step">
            <div className="step-num">1</div>
            <h4>Senior Submits</h4>
            <p>Payee, amount, and stated note are received.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">2</div>
            <h4>Hybrid AI Scores</h4>
            <p>Rules + Gemini Flash detect urgency, secrecy, and fraud.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">3</div>
            <h4>Suspicious? HELD</h4>
            <p>State machine locks payment before money leaves bank.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">4</div>
            <h4>Guardian Alerted</h4>
            <p>1-Click email allows phone approval or instant block.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">5</div>
            <h4>PayPal Releases</h4>
            <p>Funds disburse securely via PayPal Orders v2.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
