// Gmail integration for transactional emails
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken,
      },
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function createMimeMessage(to: string, subject: string, textBody: string, htmlBody: string): string {
  const boundary = 'boundary_' + Date.now().toString(36);
  const mimeMessage = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(textBody).toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64'),
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string) {
  try {
    console.log(`[EMAIL] Preparing to send password reset email to ${toEmail}`);
    const gmail = await getUncachableGmailClient();

    const appUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DEPLOYMENT_URL
      ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
      : 'http://localhost:5000';

    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
    console.log(`[EMAIL] Reset link: ${resetLink}`);

    const subject = 'Восстановление пароля - B2B Portal chip.am';
    const textBody = `Вы запросили восстановление пароля.\n\nПерейдите по ссылке для установки нового пароля:\n${resetLink}\n\nСсылка действительна в течение 1 часа.\n\nЕсли вы не запрашивали восстановление пароля, проигнорируйте это письмо.`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Восстановление пароля</h2>
        <p>Вы запросили восстановление пароля для вашего аккаунта на B2B портале chip.am.</p>
        <p>Нажмите на кнопку ниже для установки нового пароля:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px;">
            Установить новый пароль
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Ссылка действительна в течение 1 часа.</p>
        <p style="color: #666; font-size: 14px;">Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">B2B Portal chip.am</p>
      </div>
    `;

    const raw = createMimeMessage(toEmail, subject, textBody, htmlBody);

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    console.log(`[EMAIL] Gmail send completed for ${toEmail}, message id: ${result.data.id}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send email to ${toEmail}:`, err);
    throw err;
  }
}
