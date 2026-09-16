import { Resend } from 'resend'

const FROM_EMAIL =
  process.env.RESEND_FROM_ADDRESS || process.env.FROM_EMAIL || 'noreply@sonotrade.io'

// Lazily constructed so importing this module (e.g. during build page-data
// collection) doesn't throw when RESEND_API_KEY is unset.
let _resend: Resend | null = null
function resendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const client = resendClient()
  if (!client) {
    // Resend not configured — no-op gracefully so dev/preview still works.
    console.log(`[email] RESEND_API_KEY not set — OTP for ${email}: ${code}`)
    return
  }

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your Sonotrade verification code',
      html: `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #262626;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;">
              <p style="margin:0;color:#fff;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Sonotrade</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:24px;">Your verification code:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:24px 0;">
                    <div style="display:inline-block;background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:20px 48px;">
                      <span style="font-size:38px;font-weight:700;letter-spacing:12px;color:#fff;font-family:'Courier New',monospace;">${code}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#71717a;font-size:13px;">Expires in <strong style="color:#a1a1aa;">10 minutes</strong>. Never share this code.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #1f1f1f;">
              <p style="margin:0;color:#52525b;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    })
  } catch (err) {
    console.error('[email] sendOtpEmail failed:', err)
    throw err
  }
}
