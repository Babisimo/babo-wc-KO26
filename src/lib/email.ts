import nodemailer, { type Transporter } from 'nodemailer';

let cached: Transporter | null = null;

/** Lazily create a Gmail SMTP transporter from env. Throws if the credentials
 *  are missing so the caller can log/handle it rather than silently no-op. */
function transporter(): Transporter {
  if (cached) return cached;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('Email is not configured: set GMAIL_USER and GMAIL_APP_PASSWORD.');
  }
  cached = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return cached;
}

/** Send a password-reset email containing the one-time reset link. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.GMAIL_USER!;
  await transporter().sendMail({
    from: `WC26 Knockout <${from}>`,
    to,
    subject: 'Reset your WC26 Knockout password',
    text: [
      'Someone requested a password reset for your WC26 Knockout account.',
      '',
      'Reset your password (this link expires in 1 hour):',
      resetUrl,
      '',
      "If you didn't request this, you can ignore this email — your password stays the same.",
    ].join('\n'),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0a2114;">
        <h2 style="margin: 0 0 12px;">Reset your password</h2>
        <p>Someone requested a password reset for your WC26 Knockout account.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block; background:#ffd23f; color:#06210f; padding:10px 18px;
                    border-radius:8px; text-decoration:none; font-weight:700;">
            Reset password
          </a>
        </p>
        <p style="color:#5a6b62; font-size:13px;">This link expires in 1 hour. If you didn't
          request it, you can ignore this email — your password stays the same.</p>
        <p style="color:#5a6b62; font-size:12px; word-break:break-all;">${resetUrl}</p>
      </div>`,
  });
}
