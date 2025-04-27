import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import type { RouteHandler } from 'fastify';

interface RequestBody {
  ordersContent?: any;
}
const route: RouteHandler<{ Body: RequestBody }> = async (context) => {
  const { request, reply, config } = context;
  try {
    const { ordersContent }: RequestBody = request.body as RequestBody;

    const orders = formatOrders(ordersContent);

    const pdfBuffer = await createWarrantyPdf(orders);

    await sendWarrantyEmail(context, pdfBuffer, orders.length);

    await reply
      .code(200)
      .send({ message: 'Гарантійні талони успішно надіслано!' });
  } catch (error) {
    console.error('Помилка:', error);
    await reply
      .code(500)
      .send({ error: 'Не вдалося надіслати гарантійні талони.' });
  }
};

// --- Helper: Format Order Data ---
function formatOrders(ordersContent) {
  return ordersContent.map((order) => ({
    id: order.name,
    customer: `${order.customer.firstName} ${order.customer.lastName}`,
    date: new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(order.createdAt)),
    items: order.lineItems.nodes.map((item) => ({
      name: item.title,
      quantity: item.unfulfilledQuantity,
      warranty:
        item.product?.warrantyMetafield?.value ||
        (item.title.toLowerCase().includes('dimm') ? '36' : '12'),
    })),
  }));
}

// --- Helper: Draw Table ---
function drawTable(
  page,
  tableData,
  startX,
  startY,
  colWidths,
  cellHeight,
  font,
  boldFont
) {
  const rows = tableData.length;
  const cols = tableData[0].length;

  // Draw horizontal lines
  for (let i = 0; i <= rows; i++) {
    const y = startY - i * cellHeight;
    page.drawLine({
      start: { x: startX, y },
      end: { x: startX + colWidths.reduce((a, b) => a + b, 0), y },
      color: rgb(0, 0, 0),
      thickness: 0.5,
    });
  }

  // Draw vertical lines
  let xPos = startX;
  for (let j = 0; j <= cols; j++) {
    page.drawLine({
      start: { x: xPos, y: startY },
      end: { x: xPos, y: startY - rows * cellHeight },
      color: rgb(0, 0, 0),
      thickness: 0.5,
    });
    if (j < cols) {
      xPos += colWidths[j];
    }
  }

  // Place cell text
  tableData.forEach((row, rowIndex) => {
    let cellX = startX;
    row.forEach((cellText, colIndex) => {
      page.drawText(cellText, {
        x: cellX + 5,
        y: startY - rowIndex * cellHeight - cellHeight + 10,
        size: cellText.length > 50 ? 9 : 10,
        font: rowIndex === 0 ? boldFont : font,
        color: rgb(0, 0, 0),
      });
      cellX += colWidths[colIndex];
    });
  });
}

// --- Helper: Add Warranty Page ---
async function addWarrantyPage(pdfDoc, order, logoImage, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  // Draw logo
  const logoDims = logoImage.scale(0.25);
  page.drawImage(logoImage, {
    x: (width - logoDims.width) / 2,
    y: height - logoDims.height - 20,
    width: logoDims.width,
    height: logoDims.height,
  });

  // Header
  page.drawText(`Гарантійний талон ${order.id}`, {
    x: 50,
    y: height - 120,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  page.drawText(`${order.date}`, {
    x: 50,
    y: height - 150,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Table
  const tableData = [
    ['Товар', 'Кількість', 'Гарантія, міс.'],
    ...order.items.map((item) => [
      item.name,
      item.quantity.toString(),
      item.warranty,
    ]),
  ];
  const tableStartX = 50;
  let tableStartY = height - 240;
  const colWidths = [360, 60, 80];
  const cellHeight = 30;

  page.drawText('Цей документ підтверджує гарантійний термін на такі вироби:', {
    x: 50,
    y: tableStartY + 20,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });

  drawTable(
    page,
    tableData,
    tableStartX,
    tableStartY,
    colWidths,
    cellHeight,
    font,
    boldFont
  );

  // Warranty text
  let warrantyY = tableStartY - tableData.length * cellHeight - 20;
  const warrantyText = [
    'Дорогий покупець!',
    'Інформатика висловлює Вам величезну вдячність за Ваш вибір. Впевнені, що цей виріб задовольнятиме всі Ваші запити,',
    'а якість буде відповідати кращим світовим зразкам.',
    '',
    'Умови гарантії',
    '1. Гарантія дійсна лише за наявності даного талона, а також оригінальної комплектації та упаковки.',
    '2. Безкоштовний ремонт проводиться тільки протягом гарантійного терміну, зазначеного в даному талоні.',
    '3. Модель виробу має відповідати зазначеному гарантійному талону.',
    '4. Виріб знімається з гарантії у разі порушення правил експлуатації, викладених в інструкції з експлуатації.',
    '5. Виріб знімається з гарантії у таких випадках:',
    '   • Якщо виріб має сліди стороннього втручання або була спроба ремонту виробу неуповноваженою особою.',
    '   • Якщо виявлено несанкціоновані зміни конструкції виробу.',
    '6. Гарантія не поширюється на такі несправності:',
    '   • Механічні ушкодження.',
    '   • Ушкодження, спричинені впливом стихій або неналежними умовами зберігання.',
    '   • Пошкодження, спричинені використанням неоригінальних запасних частин або витратних матеріалів.',
    '   • Гарантія не поширюється на витратні матеріали.',
    '7. Термін гарантії на акумулятори та комплектуючі, що йдуть з обладнанням, становить 6 місяців.',
    '8. Ремонт виробу здійснюється у сервісному центрі за наданими координатами магазину.',
  ];
  warrantyText.forEach((line, index) => {
    page.drawText(line, {
      x: 50,
      y: warrantyY - index * 20,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

// --- Helper: Create PDF Buffer ---
async function createWarrantyPdf(orders) {
  const logoUrl =
    'https://cdn.shopify.com/s/files/1/0868/0462/7772/files/informatica-logo-good1.jpg?v=1740226141';
  const logoBytes = await (await fetch(logoUrl)).arrayBuffer();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const logoImage = await pdfDoc.embedJpg(logoBytes);

  // Embed fonts
  const fontUrl =
    'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf';
  const fontBytes = await (await fetch(fontUrl)).arrayBuffer();
  const font = await pdfDoc.embedFont(fontBytes);

  const boldFontUrl =
    'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-bold-webfont.ttf';
  const boldFontBytes = await (await fetch(boldFontUrl)).arrayBuffer();
  const boldFont = await pdfDoc.embedFont(boldFontBytes);

  for (const order of orders) {
    await addWarrantyPage(pdfDoc, order, logoImage, font, boldFont);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// --- Helper: Send Email ---
async function sendWarrantyEmail(context, pdfBuffer, ordersCount) {
  const { emails, config } = context;
  const transporter = {
    host: 'mail.adm.tools',
    port: 465,
    auth: {
      user: 'info@informatica.com.ua',
      pass: config.EMAIL_PASSWORD,
    },
  };
  emails.setTransport(transporter);

  await emails.sendMail({
    to: 'scherginets1@ukr.net',
    cc: 'nezhihai@gmail.com',
    from: 'info@informatica.com.ua',
    subject: `Гарантійні талони, ${ordersCount}шт.`,
    html: '<h1>До листа прикріплено гарантійні талони.</h1>',
    attachments: [
      {
        filename: 'garantiynyy_talon.pdf',
        content: pdfBuffer,
      },
    ],
  });
}

export default route;
