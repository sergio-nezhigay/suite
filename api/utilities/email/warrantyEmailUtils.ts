export async function sendWarrantyEmail(
  context: any,
  pdfBuffer: Buffer,
  ordersCount: number
): Promise<void> {
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
