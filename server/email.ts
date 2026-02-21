import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(toEmail: string, resetToken: string) {
  const appUrl = process.env.APP_URL || 'https://b2b.chip.am';
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

  const subject = 'Восстановление пароля - B2B Portal chip.am';
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

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject,
    html: htmlBody,
  });

  console.log(`[EMAIL] Password reset email sent to ${toEmail}`);
}
