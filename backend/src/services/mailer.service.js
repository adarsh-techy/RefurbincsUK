const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'invoices');

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends an invoice email notification with attached PDF/image to the client.
 */
async function sendInvoiceEmail({
  to,
  clientName,
  invoiceNumber,
  issueDate,
  dueDate,
  notes,
  filePath,
  fileName,
  status,
}) {
  if (!to || !to.trim()) {
    return { success: false, reason: 'no_recipient' };
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      `[Mailer] SMTP not configured in .env. Skipped sending invoice email to ${to} (Invoice: ${invoiceNumber})`
    );
    return { success: false, reason: 'smtp_unconfigured' };
  }

  const fromAddress = process.env.EMAIL_FROM || `Refurbnics Invoicing <${process.env.SMTP_USER}>`;
  const formattedIssueDate = issueDate
    ? new Date(issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Today';
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Upon receipt';
  const isPaid = status === 'paid';

  const attachments = [];
  if (filePath) {
    const fullPath = path.join(UPLOADS_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      attachments.push({
        filename: fileName || `Invoice-${invoiceNumber}.pdf`,
        path: fullPath,
      });
    }
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; color: #ffffff; text-align: left; }
          .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #10b981; }
          .title { font-size: 22px; font-weight: 800; margin: 12px 0 4px 0; color: #ffffff; }
          .subtitle { font-size: 13px; color: #94a3b8; }
          .body { padding: 28px 24px; }
          .greeting { font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 16px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
          .card-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed #e2e8f0; }
          .card-row:last-child { border-bottom: none; }
          .card-label { color: #64748b; font-weight: 600; }
          .card-value { color: #0f172a; font-weight: 700; font-family: monospace; }
          .status-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
          .status-paid { background: #dcfce7; color: #15803d; }
          .status-pending { background: #fef3c7; color: #b45309; }
          .notes { background: #f1f5f9; padding: 14px; border-radius: 10px; font-size: 12px; color: #475569; line-height: 1.5; margin-bottom: 20px; }
          .footer { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">REFURBNICS</div>
            <div class="title">Invoice Issued: ${invoiceNumber}</div>
            <div class="subtitle">Official billing statement for battery refurbishment and servicing.</div>
          </div>
          <div class="body">
            <div class="greeting">Hello ${clientName || 'Valued Client'},</div>
            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
              Please find your invoice document attached. You can also view and download all invoices anytime directly through your client dashboard.
            </p>

            <div class="card">
              <div class="card-row">
                <span class="card-label">Invoice Reference</span>
                <span class="card-value">${invoiceNumber}</span>
              </div>
              <div class="card-row">
                <span class="card-label">Issue Date</span>
                <span class="card-value">${formattedIssueDate}</span>
              </div>
              <div class="card-row">
                <span class="card-label">Payment Due Date</span>
                <span class="card-value">${formattedDueDate}</span>
              </div>
              <div class="card-row">
                <span class="card-label">Payment Status</span>
                <span>
                  <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">
                    ${isPaid ? 'Paid' : 'Pending Payment'}
                  </span>
                </span>
              </div>
            </div>

            ${notes ? `
              <div class="notes">
                <strong>Remittance Notes:</strong><br/>
                ${notes.replace(/\n/g, '<br/>')}
              </div>
            ` : ''}

            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              If you have any questions or require support regarding this invoice, please reach out via your client portal or reply directly to this email.
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Refurbnics Ltd. All rights reserved.<br/>
            Automated notification dispatch.
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `Invoice ${invoiceNumber} - Refurbnics (${clientName || 'Client'})`,
      html: htmlContent,
      attachments,
    });

    console.log(`[Mailer] Invoice email sent successfully to ${to} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer] Error sending invoice email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendInvoiceEmail,
};
