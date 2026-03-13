/**
 * lib/email.js — Email module for myLineage.
 *
 * Sends invitation and notification emails via SMTP (Nodemailer).
 * Configured through environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL
 *
 * If SMTP_HOST is not set, emails are logged to console instead of sent.
 */

'use strict';

const nodemailer = require('nodemailer');

let _transporter = null;

/**
 * Get or create the Nodemailer transporter.
 * Returns null if SMTP is not configured — emails will be logged instead.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port   = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = port === 465;

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: (process.env.SMTP_USER && process.env.SMTP_PASS)
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return _transporter;
}

/**
 * Resolve the "from" address for outgoing emails.
 */
function getFrom() {
  return process.env.SMTP_FROM || 'myLineage <noreply@mylineage.local>';
}

/**
 * Resolve the public-facing application URL (for links in emails).
 */
function getAppUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Send an email. Falls back to console.log when SMTP is not configured.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 * @returns {Promise<void>}
 */
async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();

  if (!transport) {
    console.log('[email] SMTP não configurado — email simulado:');
    console.log(`  To: ${to}\n  Subject: ${subject}\n  Body:\n${text}`);
    return;
  }

  await transport.sendMail({
    from: getFrom(),
    to,
    subject,
    text,
    html: html || undefined,
  });
}

/* ── Email templates ───────────────────────────────────────────────────── */

/**
 * Send a tree-invitation email.
 *
 * @param {{ email: string, inviterName: string, treeName: string, role: string, token: string }} opts
 */
async function sendInvitationEmail({ email, inviterName, treeName, role, token }) {
  const appUrl    = getAppUrl();
  const acceptUrl = `${appUrl}/invite.html?token=${encodeURIComponent(token)}`;
  const roleLabel = role === 'writer' ? 'editor' : 'leitor';

  const subject = `${inviterName} convidou-o para a árvore "${treeName}" — myLineage`;

  const text = [
    `Olá,`,
    ``,
    `${inviterName} convidou-o para colaborar na árvore genealógica "${treeName}" como ${roleLabel}.`,
    ``,
    `Para aceitar o convite, abra o seguinte link:`,
    `${acceptUrl}`,
    ``,
    `Se não tem conta, será convidado a registar-se.`,
    ``,
    `Este convite expira em 7 dias.`,
    ``,
    `— myLineage`,
  ].join('\n');

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
      <h2 style="color:#4493f8;">myLineage</h2>
      <p>Olá,</p>
      <p><strong>${escapeHtml(inviterName)}</strong> convidou-o para colaborar na árvore genealógica
         <strong>&ldquo;${escapeHtml(treeName)}&rdquo;</strong> como <strong>${escapeHtml(roleLabel)}</strong>.</p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(acceptUrl)}"
           style="display:inline-block;padding:12px 28px;background:#4493f8;color:#fff;
                  text-decoration:none;border-radius:6px;font-weight:600;">
          Aceitar convite
        </a>
      </p>
      <p style="font-size:0.88em;color:#666;">Se não tem conta, será convidado a registar-se.</p>
      <p style="font-size:0.82em;color:#999;">Este convite expira em 7 dias.</p>
    </div>`;

  await sendMail({ to: email, subject, text, html });
}

/**
 * Send a notification email (generic).
 *
 * @param {{ email: string, subject: string, body: string }}
 */
async function sendNotificationEmail({ email, subject, body }) {
  await sendMail({ to: email, subject, text: body });
}

/* ── Utility ───────────────────────────────────────────────────────────── */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendMail,
  sendInvitationEmail,
  sendNotificationEmail,
  getAppUrl,
};
