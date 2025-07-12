import { PDFDocument, rgb, PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Define necessary types locally or import if moved to a shared types file
interface WarrantyOrderItem {
  name: string;
  quantity: number;
  warranty: string;
}

interface WarrantyOrder {
  id: string;
  customer: string;
  date: string;
  items: WarrantyOrderItem[];
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (textWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Single word is too long, force break
        lines.push(word);
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawTable(
  page: PDFPage,
  tableData: string[][],
  startX: number,
  startY: number,
  colWidths: number[],
  cellHeight: number,
  font: PDFFont,
  boldFont: PDFFont
): void {
  // Calculate required rows considering text wrapping
  const processedRows: string[][][] = [];
  let maxRowHeight = 1;

  tableData.forEach((row, rowIndex) => {
    const processedRow: string[][] = [];
    let currentRowHeight = 1;

    row.forEach((cellText, colIndex) => {
      const maxWidth = colWidths[colIndex] - 10; // 5px padding on each side
      const fontSize = cellText.length > 50 ? 9 : 10;
      const currentFont = rowIndex === 0 ? boldFont : font;

      const wrappedLines = wrapText(cellText, maxWidth, currentFont, fontSize);
      processedRow.push(wrappedLines);
      currentRowHeight = Math.max(currentRowHeight, wrappedLines.length);
    });

    processedRows.push(processedRow);
    maxRowHeight = Math.max(maxRowHeight, currentRowHeight);
  });

  // Calculate dynamic row heights
  const rowHeights = processedRows.map((row) => {
    const maxLines = Math.max(...row.map((cell) => cell.length));
    return Math.max(cellHeight, maxLines * 15); // 15px per line
  });

  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);

  // Draw horizontal lines with dynamic spacing
  let currentY = startY;
  for (let i = 0; i <= processedRows.length; i++) {
    page.drawLine({
      start: { x: startX, y: currentY },
      end: { x: startX + colWidths.reduce((a, b) => a + b, 0), y: currentY },
      color: rgb(0, 0, 0),
      thickness: 0.5,
    });
    if (i < rowHeights.length) {
      currentY -= rowHeights[i];
    }
  }

  // Draw vertical lines
  let xPos = startX;
  for (let j = 0; j <= colWidths.length; j++) {
    page.drawLine({
      start: { x: xPos, y: startY },
      end: { x: xPos, y: startY - totalHeight },
      color: rgb(0, 0, 0),
      thickness: 0.5,
    });
    if (j < colWidths.length) {
      xPos += colWidths[j];
    }
  }

  // Place wrapped text
  currentY = startY;
  processedRows.forEach((row, rowIndex) => {
    let cellX = startX;

    row.forEach((cellLines, colIndex) => {
      const fontSize = tableData[rowIndex][colIndex].length > 50 ? 9 : 10;
      const currentFont = rowIndex === 0 ? boldFont : font;

      cellLines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: cellX + 5,
          y: currentY - 15 - lineIndex * 15,
          size: fontSize,
          font: currentFont,
          color: rgb(0, 0, 0),
        });
      });

      cellX += colWidths[colIndex];
    });

    currentY -= rowHeights[rowIndex];
  });
}

async function addWarrantyPage(
  pdfDoc: PDFDocument,
  order: WarrantyOrder,
  logoImage: PDFImage,
  font: PDFFont,
  boldFont: PDFFont
): Promise<void> {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const logoDims = logoImage.scale(0.25);
  page.drawImage(logoImage, {
    x: (width - logoDims.width) / 2,
    y: height - logoDims.height - 20,
    width: logoDims.width,
    height: logoDims.height,
  });

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

export async function createWarrantyPdf(
  orders: WarrantyOrder[]
): Promise<Buffer> {
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
