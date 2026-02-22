import PDFDocument from 'pdfkit';
import path from 'path';
import type { Customer, Order, Product, Settings } from '@shared/schema';

// Unicode-capable fonts (supports Cyrillic + Armenian including ֏ U+058F)
const FONTS_DIR = path.join(process.cwd(), 'server', 'fonts');
const REGULAR_FONT = path.join(FONTS_DIR, 'DejaVuSans.ttf');
const BOLD_FONT = path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf');

function registerFonts(doc: InstanceType<typeof PDFDocument>) {
  doc.registerFont('Regular', REGULAR_FONT);
  doc.registerFont('Bold', BOLD_FONT);
}

const BRAND_COLOR = '#277a3c'; // chip.am dark green
const LIGHT_GRAY = '#f3f4f6';
const DARK_GRAY = '#374151';
const MED_GRAY = '#6b7280';
const APP_URL = process.env.APP_URL || 'https://b2b.chip.am';

type OrderItem = { productId: string; name?: string; price: number; quantity: number };

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatAMD(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' AMD';
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'paid': return 'Оплачен';
    case 'partially_paid': return 'Частично оплачен';
    default: return 'Не оплачен';
  }
}

function deliveryStatusLabel(status: string): string {
  switch (status) {
    case 'processing': return 'Принят';
    case 'confirmed': return 'Подтверждён';
    case 'transit': return 'В пути';
    case 'delivered': return 'Доставлен';
    default: return status;
  }
}

function stockLabel(stock: string): string {
  switch (stock) {
    case 'in_stock': return 'В наличии';
    case 'low_stock': return 'Уточняйте';
    case 'out_of_stock': return 'Нет в наличии';
    case 'on_order': return 'На заказ';
    default: return stock;
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────

function drawHeader(doc: InstanceType<typeof PDFDocument>, title: string) {
  // Blue header bar
  doc.rect(0, 0, doc.page.width, 80).fill(BRAND_COLOR);

  // Company name
  doc.fillColor('white').font('Bold').fontSize(20)
    .text('CHIP Technologies', 40, 25, { continued: false });

  doc.fillColor('white').font('Regular').fontSize(10)
    .text('B2B Portal — ' + APP_URL, 40, 50);

  // Document title (right aligned)
  doc.fillColor('white').font('Bold').fontSize(16)
    .text(title, 0, 30, { align: 'right', width: doc.page.width - 40 });

  doc.fillColor(DARK_GRAY);
  doc.moveDown(3);
}

function drawFooter(doc: InstanceType<typeof PDFDocument>) {
  const bottom = doc.page.height - 40;
  doc.moveTo(40, bottom - 10).lineTo(doc.page.width - 40, bottom - 10)
    .strokeColor('#e5e7eb').lineWidth(1).stroke();
  // lineBreak: false prevents cursor from advancing past the page margin
  // and triggering an unwanted blank second page
  const dateStr = `Сформировано: ${new Date().toLocaleDateString('ru-RU')} | `;
  doc.font('Regular').fontSize(8);
  const textW = doc.widthOfString(dateStr + 'b2b.chip.am');
  const textX = (doc.page.width - textW) / 2;
  doc.fillColor(MED_GRAY)
    .text(dateStr, textX, bottom - 5, { continued: true, lineBreak: false });
  doc.fillColor(BRAND_COLOR)
    .text('b2b.chip.am', { link: 'https://b2b.chip.am', underline: true, lineBreak: false });
}

// ─── Invoice PDF ─────────────────────────────────────────────────────────────

export function generateInvoicePDF(
  order: Order & { customerName?: string },
  customer: Customer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    registerFonts(doc);
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'НАКЛАДНАЯ / INVOICE');

    const items = (order.items as OrderItem[]) ?? [];

    // ── Order meta info ──
    const startY = 100;
    doc.font('Bold').fontSize(11).fillColor(BRAND_COLOR)
      .text('Информация о заказе', 40, startY);
    doc.moveTo(40, startY + 16).lineTo(doc.page.width - 40, startY + 16)
      .strokeColor(BRAND_COLOR).lineWidth(1).stroke();

    doc.font('Regular').fontSize(10).fillColor(DARK_GRAY);
    const metaY = startY + 24;
    doc.text(`Номер заказа:`, 40, metaY, { continued: true })
       .font('Bold').text(` #${order.orderNumber}`);
    doc.font('Regular').text(`Дата заказа:`, 40, metaY + 16, { continued: true })
       .font('Bold').text(` ${formatDate(order.createdAt)}`);
    if (order.deliveryDate) {
      doc.font('Regular').text(`Дата доставки:`, 40, metaY + 32, { continued: true })
         .font('Bold').text(` ${formatDate(order.deliveryDate)}`);
    }

    // ── Customer info ──
    const custY = metaY + (order.deliveryDate ? 48 : 32);
    doc.font('Bold').fontSize(11).fillColor(BRAND_COLOR)
      .text('Клиент', 40, custY);
    doc.moveTo(40, custY + 16).lineTo(doc.page.width - 40, custY + 16)
      .strokeColor(BRAND_COLOR).lineWidth(1).stroke();

    doc.font('Regular').fontSize(10).fillColor(DARK_GRAY);
    const cY = custY + 24;
    doc.text(`Компания: ${customer.companyName}`, 40, cY);
    doc.text(`ИНН: ${customer.taxId}`, 40, cY + 16);
    doc.text(`Email: ${customer.email}`, 40, cY + 32);
    doc.text(`Телефон: ${customer.phone}`, 40, cY + 48);

    // ── Company payment details ──
    const payY = cY + 64;
    doc.font('Bold').fontSize(11).fillColor(BRAND_COLOR)
      .text('Реквизиты получателя', 40, payY);
    doc.moveTo(40, payY + 16).lineTo(doc.page.width - 40, payY + 16)
      .strokeColor(BRAND_COLOR).lineWidth(1).stroke();

    doc.font('Regular').fontSize(10).fillColor(DARK_GRAY);
    doc.text('Получатель: ԱՁ Սalbина Аleksanyаn', 40, payY + 24);
    doc.text('Банк: Ամերիաբանկ ՓԲԸ', 40, payY + 40);
    doc.text('Счёт: 1570065472180100', 40, payY + 56);

    // ── Items table ──
    const tableStartY = payY + 80;
    doc.font('Bold').fontSize(11).fillColor(BRAND_COLOR)
      .text('Товары', 40, tableStartY);
    doc.moveTo(40, tableStartY + 16).lineTo(doc.page.width - 40, tableStartY + 16)
      .strokeColor(BRAND_COLOR).lineWidth(1).stroke();

    // Table header
    const colX = { num: 40, name: 65, qty: 360, price: 420, total: 500 };
    const headerY = tableStartY + 22;
    doc.rect(40, headerY, doc.page.width - 80, 18).fill(BRAND_COLOR);
    doc.fillColor('white').font('Bold').fontSize(9);
    doc.text('#', colX.num, headerY + 4);
    doc.text('Наименование', colX.name, headerY + 4);
    doc.text('Кол-во', colX.qty, headerY + 4);
    doc.text('Цена (AMD)', colX.price, headerY + 4);
    doc.text('Сумма (AMD)', colX.total, headerY + 4);

    // Table rows
    let rowY = headerY + 22;
    items.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? 'white' : LIGHT_GRAY;
      doc.rect(40, rowY, doc.page.width - 80, 18).fill(bg);
      doc.fillColor(DARK_GRAY).font('Regular').fontSize(9);
      doc.text(String(idx + 1), colX.num, rowY + 4);
      doc.text(item.name ?? 'Товар', colX.name, rowY + 4, { width: 285, ellipsis: true });
      doc.text(String(item.quantity), colX.qty, rowY + 4);
      doc.text(item.price.toLocaleString('ru-RU'), colX.price, rowY + 4);
      doc.text((item.price * item.quantity).toLocaleString('ru-RU'), colX.total, rowY + 4);
      rowY += 18;
    });

    // Total row
    doc.rect(40, rowY, doc.page.width - 80, 22).fill(BRAND_COLOR);
    doc.fillColor('white').font('Bold').fontSize(10);
    doc.text('ИТОГО:', colX.price - 50, rowY + 5, { width: 100, align: 'right' });
    doc.text(formatAMD(order.total), colX.total - 5, rowY + 5);

    drawFooter(doc);
    doc.end();
  });
}

// ─── Price List PDF ───────────────────────────────────────────────────────────

export function generatePriceListPDF(
  customer: Customer,
  products: Product[],
  settings: Settings | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    registerFonts(doc);
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'ПРАЙС-ЛИСТ');

    // Customer type & markup info
    const corporateMarkup = settings?.corporateMarkupPercentage ?? 10;
    const governmentMarkup = settings?.governmentMarkupPercentage ?? 10;

    function getCustomerPrice(basePrice: number): number {
      if (customer.customerType === 'корпоративный') {
        return Math.ceil((basePrice * (1 + corporateMarkup / 100)) / 100) * 100;
      }
      if (customer.customerType === 'гос. учреждение') {
        return Math.ceil((basePrice * (1 + governmentMarkup / 100)) / 100) * 100;
      }
      return basePrice; // дилер
    }

    const startY = 100;
    doc.font('Regular').fontSize(10).fillColor(DARK_GRAY);
    doc.text(`Клиент: `, 40, startY, { continued: true })
       .font('Bold').text(customer.companyName);
    doc.font('Regular').text(`ИНН: ${customer.taxId}`, 40, startY + 16);
    doc.text(`Тип клиента: ${customer.customerType}`, 40, startY + 32);
    doc.text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`, 40, startY + 48);

    // Filter products visible to this customer type
    const visibleProducts = products.filter(p => {
      if (!p.visibleCustomerTypes || p.visibleCustomerTypes.length === 0) return true;
      return p.visibleCustomerTypes.includes(customer.customerType);
    });

    // Table
    const tableStartY = startY + 72;
    doc.font('Bold').fontSize(11).fillColor(BRAND_COLOR)
      .text(`Товары (${visibleProducts.length} позиций)`, 40, tableStartY);
    doc.moveTo(40, tableStartY + 16).lineTo(doc.page.width - 40, tableStartY + 16)
      .strokeColor(BRAND_COLOR).lineWidth(1).stroke();

    const colX = { num: 40, name: 60, brand: 280, category: 355, price: 450, stock: 515 };
    const headerY = tableStartY + 22;
    doc.rect(40, headerY, doc.page.width - 80, 18).fill(BRAND_COLOR);
    doc.fillColor('white').font('Bold').fontSize(8);
    doc.text('#', colX.num, headerY + 4);
    doc.text('Наименование', colX.name, headerY + 4);
    doc.text('Бренд', colX.brand, headerY + 4);
    doc.text('Категория', colX.category, headerY + 4);
    doc.text('Цена (AMD)', colX.price, headerY + 4);
    doc.text('Наличие', colX.stock, headerY + 4);

    let rowY = headerY + 22;
    visibleProducts.forEach((product, idx) => {
      // New page if needed
      if (rowY > doc.page.height - 80) {
        drawFooter(doc);
        doc.addPage();
        rowY = 50;
      }

      const bg = idx % 2 === 0 ? 'white' : LIGHT_GRAY;
      doc.rect(40, rowY, doc.page.width - 80, 16).fill(bg);
      doc.fillColor(DARK_GRAY).font('Regular').fontSize(8);
      doc.text(String(idx + 1), colX.num, rowY + 3);
      doc.text(product.name, colX.name, rowY + 3, { width: 215, ellipsis: true });
      doc.text(product.brand ?? '—', colX.brand, rowY + 3, { width: 70, ellipsis: true });
      doc.text(product.category ?? '—', colX.category, rowY + 3, { width: 90, ellipsis: true });
      doc.text(getCustomerPrice(product.price).toLocaleString('ru-RU'), colX.price, rowY + 3, { width: 60, align: 'right' });
      doc.text(stockLabel(product.stock), colX.stock, rowY + 3, { width: 55, ellipsis: true });
      rowY += 16;
    });

    drawFooter(doc);
    doc.end();
  });
}
