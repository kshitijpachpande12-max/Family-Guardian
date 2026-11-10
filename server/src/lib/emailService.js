// ================================================
// Guardian Notification Service (Nodemailer + Mailtrap)
// ================================================
// Handles automated alerts when a payment is HELD:
// 1. Signs cryptographically secure action tokens (JWT)
// 2. Generates responsive HTML email with plain-language scam warnings
// 3. Delivers via Mailtrap sandbox (or logs if unconfigured)
// ================================================

const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

/**
 * Generates a signed, single-purpose JWT for one-click email actions.
 *
 * @param {string} paymentId - Payment ID to act upon
 * @param {string} guardianId - Guardian authorized to act
 * @param {('approve'|'block')} action - Proposed state action
 * @returns {string} Signed JWT string valid for 24 hours
 */
function generateActionToken(paymentId, guardianId, action) {
  return jwt.sign(
    {
      paymentId,
      guardianId,
      action,
      purpose: 'guardian_action'
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verifies and decodes a one-click action token.
 *
 * @param {string} token - Signed JWT from email link
 * @returns {Object} Decoded payload { paymentId, guardianId, action }
 */
function verifyActionToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.purpose !== 'guardian_action') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
}

/**
 * Configures the Nodemailer transporter.
 */
function createTransporter() {
  const host = process.env.MAILTRAP_HOST;
  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;

  const isConfigured =
    host &&
    user &&
    pass &&
    !user.includes('your-mailtrap') &&
    !pass.includes('your-mailtrap');

  if (!isConfigured) {
    return null; // Signals mock/console fallback mode
  }

  return nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
    port: Number(process.env.MAILTRAP_PORT) || 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS
    }
  });
}

/**
 * Builds high-contrast, responsive HTML email for the guardian.
 */
function buildAlertEmailHtml({ senior, payment, approveUrl, blockUrl }) {
  const flagsHtml = (payment.ruleFlags || [])
    .map(flag => `<span style="display:inline-block;background:#fee2e2;color:#991b1b;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;margin-right:6px;margin-bottom:6px;">⚠️ ${flag.replace(/_/g, ' ').toUpperCase()}</span>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Protection Alert</title>
</head>
<body style="margin:0;padding:20px;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
    
    <!-- Header Banner -->
    <div style="background:#dc2626;padding:24px;text-align:center;color:#ffffff;">
      <h1 style="margin:0;font-size:24px;font-weight:700;">🛡️ Suspicious Payment Held</h1>
      <p style="margin:6px 0 0 0;font-size:15px;opacity:0.95;">Family Guardian Security Alert for ${senior.name}</p>
    </div>

    <!-- Body Details -->
    <div style="padding:28px 24px;">
      <p style="font-size:16px;line-height:1.5;margin-top:0;">
        Hello, <strong>${senior.name}</strong> has submitted a payment request that our AI security system has flagged as potentially unsafe. The payment has been <strong>PAUSED</strong> and requires your approval before any money is sent.
      </p>

      <!-- Payment Summary Card -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:18px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:35%;">Recipient / Payee:</td>
            <td style="padding:6px 0;font-weight:600;color:#111827;">${payment.payee}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">Amount:</td>
            <td style="padding:6px 0;font-weight:700;color:#dc2626;font-size:18px;">$${Number(payment.amount).toFixed(2)} USD</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">Senior's Note:</td>
            <td style="padding:6px 0;font-style:italic;color:#374151;">"${payment.reason}"</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">Risk Assessment:</td>
            <td style="padding:6px 0;font-weight:700;color:#dc2626;">${payment.riskScore}/100 (${(payment.riskLevel || 'high').toUpperCase()})</td>
          </tr>
        </table>
      </div>

      <!-- Security Flags & AI Explanation -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:14px;text-transform:uppercase;color:#4b5563;letter-spacing:0.5px;margin:0 0 8px 0;">Detected Red Flags:</h3>
        <div style="margin-bottom:12px;">${flagsHtml || '<span style="color:#6b7280;font-size:13px;">Pattern anomaly detected by AI</span>'}</div>
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px;color:#92400e;line-height:1.5;">
          <strong>Why this was held:</strong> ${payment.riskExplanation || 'Elevated risk detected. Please confirm this payment is legitimate.'}
        </div>
      </div>

      <!-- Emergency Action Buttons -->
      <div style="text-align:center;margin:32px 0 20px 0;">
        <a href="${blockUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:16px;margin:0 8px 12px 8px;box-shadow:0 2px 4px rgba(220,38,38,0.2);">
          🚨 BLOCK THIS SCAM
        </a>
        <a href="${approveUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:16px;margin:0 8px 12px 8px;box-shadow:0 2px 4px rgba(16,185,129,0.2);">
          ✅ APPROVE PAYMENT
        </a>
      </div>

      <p style="font-size:13px;color:#9ca3af;text-align:center;margin-top:24px;line-height:1.4;">
        Clicking a button securely resolves this request in one click. No login required.<br>
        Links expire in 24 hours. Powered by Family Guardian AI & PayPal Sandbox.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Sends notification email to the guardian.
 *
 * @param {Object} params - { senior, payment, guardian }
 * @returns {Promise<Object>} Delivery result with action URLs
 */
async function sendGuardianAlert({ senior, payment, guardian }) {
  const serverBase = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

  const approveToken = generateActionToken(payment._id.toString(), guardian._id.toString(), 'approve');
  const blockToken = generateActionToken(payment._id.toString(), guardian._id.toString(), 'block');

  const approveUrl = `${serverBase}/api/payments/action?token=${approveToken}`;
  const blockUrl = `${serverBase}/api/payments/action?token=${blockToken}`;

  const transporter = createTransporter();

  const mailOptions = {
    from: '"Family Guardian Alert" <alerts@familyguardian.app>',
    to: guardian.email,
    subject: `🚨 ALERT: Suspicious payment of $${payment.amount} held for ${senior.name}`,
    html: buildAlertEmailHtml({ senior, payment, approveUrl, blockUrl })
  };

  if (!transporter) {
    // Graceful console fallback if Mailtrap is unconfigured
    console.log('\n============================================================');
    console.log('✉️  [MAILTRAP SIMULATOR] Email Notification to Guardian:');
    console.log(`To: ${guardian.email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`🚨 BLOCK URL   : ${blockUrl}`);
    console.log(`✅ APPROVE URL : ${approveUrl}`);
    console.log('============================================================\n');

    return {
      success: true,
      simulated: true,
      approveUrl,
      blockUrl
    };
  }

  const info = await transporter.sendMail(mailOptions);
  return {
    success: true,
    messageId: info.messageId,
    approveUrl,
    blockUrl
  };
}

module.exports = {
  generateActionToken,
  verifyActionToken,
  sendGuardianAlert
};
