import nodemailer from 'nodemailer';
import type { Customer, Order } from '@shared/schema';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const APP_URL = process.env.APP_URL || 'https://b2b.chip.am';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@b2b.chip.am';

// ─── Base template ────────────────────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#1d4ed8;padding:24px 32px;">
      <h1 style="color:white;margin:0;font-size:20px;">chip.am — B2B Portal</h1>
      <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">${APP_URL}</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1f2937;margin:0 0 16px;">${title}</h2>
      ${body}
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">B2B Portal chip.am — Это письмо сформировано автоматически, не отвечайте на него.</p>
    </div>
  </div>`;
}

function btn(href: string, label: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="background:#1d4ed8;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold;">${label}</a>
  </div>`;
}

async function send(to: string, subject: string, html: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`[EMAIL] Skipped (no credentials): ${subject} → ${to}`);
    return;
  }
  await transporter.sendMail({ from: process.env.GMAIL_USER, to, subject, html });
  console.log(`[EMAIL] Sent "${subject}" → ${to}`);
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(toEmail: string, resetToken: string) {
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;
  const html = baseTemplate('Восстановление пароля', `
    <p style="color:#374151;">Вы запросили восстановление пароля для вашего аккаунта на B2B портале chip.am.</p>
    <p style="color:#374151;">Нажмите кнопку ниже для установки нового пароля:</p>
    ${btn(resetLink, 'Установить новый пароль')}
    <p style="color:#6b7280;font-size:13px;">Ссылка действительна в течение 1 часа. Если вы не запрашивали восстановление пароля — проигнорируйте это письмо.</p>
  `);
  await send(toEmail, 'Восстановление пароля — B2B Portal chip.am', html);
}

// ─── Registration notifications ───────────────────────────────────────────────

export async function sendRegistrationApprovedEmail(customer: Customer) {
  const html = baseTemplate('Ваша заявка одобрена ✓', `
    <p style="color:#374151;">Здравствуйте, <strong>${customer.representativeName}</strong>!</p>
    <p style="color:#374151;">Ваша заявка на доступ к B2B порталу chip.am от имени компании <strong>${customer.companyName}</strong> была <span style="color:#16a34a;font-weight:bold;">одобрена</span>.</p>
    <p style="color:#374151;">Теперь вы можете войти в систему и начать работу с каталогом товаров.</p>
    ${btn(`${APP_URL}/login`, 'Войти в B2B Portal')}
  `);
  await send(customer.email, 'Заявка одобрена — B2B Portal chip.am', html);
}

export async function sendRegistrationRejectedEmail(customer: Customer) {
  const html = baseTemplate('Заявка отклонена', `
    <p style="color:#374151;">Здравствуйте, <strong>${customer.representativeName}</strong>.</p>
    <p style="color:#374151;">К сожалению, ваша заявка на доступ к B2B порталу chip.am от имени компании <strong>${customer.companyName}</strong> была <span style="color:#dc2626;font-weight:bold;">отклонена</span>.</p>
    <p style="color:#374151;">Для получения подробной информации обратитесь к нашим менеджерам.</p>
    <p style="color:#374151;">Телефон: <a href="tel:+37410000000">+374 10 00-00-00</a></p>
  `);
  await send(customer.email, 'Заявка отклонена — B2B Portal chip.am', html);
}

export async function sendAdminNewRegistrationEmail(customer: Customer) {
  const html = baseTemplate('Новая заявка на регистрацию', `
    <p style="color:#374151;">Новый клиент подал заявку на регистрацию в B2B Portal:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Компания:</td><td style="padding:6px 0;font-weight:bold;">${customer.companyName}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">ИНН:</td><td style="padding:6px 0;">${customer.taxId}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Представитель:</td><td style="padding:6px 0;">${customer.representativeName}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Email:</td><td style="padding:6px 0;">${customer.email}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Телефон:</td><td style="padding:6px 0;">${customer.phone}</td></tr>
    </table>
    ${btn(`${APP_URL}/admin?section=registrations`, 'Просмотреть в панели')}
  `);
  await send(ADMIN_EMAIL, `Новая заявка: ${customer.companyName} — B2B Portal`, html);
}

// ─── Order notifications ──────────────────────────────────────────────────────

function orderItemsTable(items: any[]): string {
  const rows = items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.name ?? 'Товар'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${(item.price * item.quantity).toLocaleString('ru-RU')} ֏</td>
    </tr>`).join('');
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead>
        <tr style="background:#1d4ed8;color:white;">
          <th style="padding:8px;text-align:left;">Наименование</th>
          <th style="padding:8px;text-align:center;">Кол-во</th>
          <th style="padding:8px;text-align:right;">Сумма</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f3f4f6;font-weight:bold;">
          <td colspan="2" style="padding:8px;text-align:right;">ИТОГО:</td>
          <td style="padding:8px;text-align:right;">${(items.reduce((s, i) => s + i.price * i.quantity, 0)).toLocaleString('ru-RU')} ֏</td>
        </tr>
      </tfoot>
    </table>`;
}

export async function sendOrderConfirmationEmail(customer: Customer, order: Order) {
  const items = (order.items as any[]) ?? [];
  const html = baseTemplate('Ваш заказ получен ✓', `
    <p style="color:#374151;">Здравствуйте, <strong>${customer.representativeName}</strong>!</p>
    <p style="color:#374151;">Ваш заказ <strong>#${order.orderNumber}</strong> успешно оформлен и передан менеджерам для обработки.</p>
    ${orderItemsTable(items)}
    ${btn(`${APP_URL}/orders/${order.id}`, 'Просмотреть заказ')}
    <p style="color:#6b7280;font-size:13px;">Мы свяжемся с вами для подтверждения деталей.</p>
  `);
  await send(customer.email, `Заказ #${order.orderNumber} принят — B2B Portal chip.am`, html);
}

export async function sendOrderStatusChangedEmail(customer: Customer, order: Order, changeType: 'payment' | 'delivery') {
  const isPayment = changeType === 'payment';
  const statusMap: Record<string, string> = {
    not_paid: 'Не оплачен', partially_paid: 'Частично оплачен', paid: 'Оплачен',
    processing: 'Принят', confirmed: 'Подтверждён', transit: 'В пути', delivered: 'Доставлен',
  };
  const newStatus = isPayment
    ? statusMap[order.paymentStatus] ?? order.paymentStatus
    : statusMap[order.deliveryStatus] ?? order.deliveryStatus;
  const label = isPayment ? 'Статус оплаты' : 'Статус доставки';

  const html = baseTemplate(`Обновление заказа #${order.orderNumber}`, `
    <p style="color:#374151;">Здравствуйте, <strong>${customer.representativeName}</strong>!</p>
    <p style="color:#374151;">Статус вашего заказа <strong>#${order.orderNumber}</strong> был обновлён.</p>
    <div style="background:#f0f9ff;border-left:4px solid #1d4ed8;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
      <p style="margin:0;color:#374151;"><strong>${label}:</strong> ${newStatus}</p>
    </div>
    ${btn(`${APP_URL}/orders/${order.id}`, 'Просмотреть заказ')}
  `);
  await send(customer.email, `Обновление заказа #${order.orderNumber} — B2B Portal chip.am`, html);
}

export async function sendAdminNewOrderEmail(customer: Customer, order: Order) {
  const items = (order.items as any[]) ?? [];
  const html = baseTemplate('Новый заказ', `
    <p style="color:#374151;">Клиент <strong>${customer.companyName}</strong> оформил заказ на сумму <strong>${order.total.toLocaleString('ru-RU')} ֏</strong>.</p>
    ${orderItemsTable(items)}
    ${btn(`${APP_URL}/admin?section=orders`, 'Открыть в панели')}
  `);
  await send(ADMIN_EMAIL, `Новый заказ #${order.orderNumber} от ${customer.companyName}`, html);
}

// ─── Inquiry notifications ────────────────────────────────────────────────────

export async function sendNewOfferEmail(customer: Customer, inquiryId: string) {
  const html = baseTemplate('По вашему запросу получено предложение', `
    <p style="color:#374151;">Здравствуйте, <strong>${customer.representativeName}</strong>!</p>
    <p style="color:#374151;">Наши менеджеры подготовили предложение по вашему запросу. Пожалуйста, ознакомьтесь с ним в личном кабинете.</p>
    ${btn(`${APP_URL}/?section=inquiries`, 'Просмотреть предложение')}
  `);
  await send(customer.email, 'Новое предложение по вашему запросу — B2B Portal chip.am', html);
}

export async function sendAdminNewInquiryEmail(customer: Customer) {
  const html = baseTemplate('Новый запрос от клиента', `
    <p style="color:#374151;">Клиент <strong>${customer.companyName}</strong> (${customer.representativeName}) отправил новый запрос на подбор товаров.</p>
    ${btn(`${APP_URL}/admin?section=inquiries`, 'Просмотреть запрос')}
  `);
  await send(ADMIN_EMAIL, `Новый запрос от ${customer.companyName} — B2B Portal`, html);
}

// ─── Overdue payment reminders ────────────────────────────────────────────────

export async function sendOverdueReminderEmail(customer: Customer, overdueOrders: Order[]) {
  const totalOverdue = overdueOrders.reduce((sum, o) => {
    const paid = o.paymentStatus === 'partially_paid' ? o.total * 0.5 : 0; // conservative estimate
    return sum + (o.total - paid);
  }, 0);

  const orderRows = overdueOrders.map(o => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">#${o.orderNumber}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${new Date(o.createdAt!).toLocaleDateString('ru-RU')}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${o.total.toLocaleString('ru-RU')} ֏</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${o.paymentStatus === 'partially_paid' ? 'Частично оплачен' : 'Не оплачен'}</td>
    </tr>`).join('');

  const html = baseTemplate('Напоминание о просроченных платежах', `
    <p style="color:#374151;">Здравствуйте, <strong>${customer.representativeName}</strong>!</p>
    <p style="color:#374151;">У вашей компании <strong>${customer.companyName}</strong> имеются заказы с просроченными платежами:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead>
        <tr style="background:#dc2626;color:white;">
          <th style="padding:8px;text-align:left;">Заказ</th>
          <th style="padding:8px;text-align:left;">Дата</th>
          <th style="padding:8px;text-align:right;">Сумма</th>
          <th style="padding:8px;text-align:left;">Статус</th>
        </tr>
      </thead>
      <tbody>${orderRows}</tbody>
    </table>
    <p style="color:#374151;">Пожалуйста, произведите оплату в ближайшее время во избежание ограничений аккаунта.</p>
    ${btn(`${APP_URL}/?section=orders`, 'Просмотреть заказы')}
    <p style="color:#6b7280;font-size:13px;">Если у вас есть вопросы, свяжитесь с вашим менеджером.</p>
  `);
  await send(customer.email, 'Напоминание об оплате — B2B Portal chip.am', html);
}
