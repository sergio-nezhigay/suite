import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const route = async ({ request, reply, emails, config }) => {
  const { ordersContent } = request.body;
  const orders = ordersContent.map((order) => ({
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
        item.title.toLowerCase().includes('dimm')
          ? '36'
          : '12',
    })),
  }));

  // Configure email transport
  const transporter = {
    host: 'mail.adm.tools',
    port: 465,
    auth: {
      user: 'info@informatica.com.ua',
      pass: config.EMAIL_PASSWORD,
    },
  };
  emails.setTransport(transporter);

  try {
    // Fetch and embed logo image
    const logoUrl =
      'https://cdn.shopify.com/s/files/1/0868/0462/7772/files/informatica-logo-good1.jpg?v=1740226141';
    const logoBytes = await (await fetch(logoUrl)).arrayBuffer();

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const logoImage = await pdfDoc.embedJpg(logoBytes);

    // Embed custom font
    const fontUrl =
      'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf';
    const fontBytes = await (await fetch(fontUrl)).arrayBuffer();
    const font = await pdfDoc.embedFont(fontBytes);

    const boldFontUrl =
      'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-bold-webfont.ttf';
    const boldFontBytes = await (await fetch(boldFontUrl)).arrayBuffer();
    const boldFont = await pdfDoc.embedFont(boldFontBytes);

    // Helper function: draw a simple table manually
    function drawTable(page, tableData, startX, startY, colWidths, cellHeight) {
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

      // Place cell text with some padding
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

    // For each order, create a new page and draw the content
    orders.forEach((order) => {
      const page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();

      // Draw the logo at the top center
      const logoDims = logoImage.scale(0.25);
      page.drawImage(logoImage, {
        x: (width - logoDims.width) / 2,
        y: height - logoDims.height - 20,
        width: logoDims.width,
        height: logoDims.height,
      });

      // Header texts
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

      // Define table data:
      // Header row plus each order item as a row
      const tableData = [
        ['Товар', 'Кількість', 'Гарантія, міс.'],
        ...order.items.map((item) => [
          item.name,
          item.quantity.toString(),
          item.warranty,
        ]),
      ];

      // Table layout parameters
      const tableStartX = 50;
      let tableStartY = height - 240;
      // Define column widths (in points)
      const colWidths = [360, 60, 80];
      const cellHeight = 30;

      // Draw the header row in blue (optional: you can also change font color per cell)
      // For simplicity, our drawTable function uses the same settings for all cells.
      // To customize header colors, you could modify drawTable further.
      page.drawText(
        'Цей документ підтверджує гарантійний термін на такі вироби:',
        {
          x: 50,
          y: tableStartY + 20,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        }
      );

      drawTable(
        page,
        tableData,
        tableStartX,
        tableStartY,
        colWidths,
        cellHeight
      );

      // After table, add warranty conditions text
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
    });

    // Save PDF and prepare buffer for attachment
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Send the PDF as an email attachment
    await emails.sendMail({
      to: 'scherginets@ukr.net',
      cc: 'nezhihai@gmail.com',
      from: 'info@informatica.com.ua',
      subject: `Гарантійні талони, ${orders.length}шт.`,
      html: '<h1>До листа прикріплено гарантійні талони.</h1>',
      attachments: [
        {
          filename: 'garantiynyy_talon.pdf',
          content: pdfBuffer,
        },
      ],
    });

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

export default route;
