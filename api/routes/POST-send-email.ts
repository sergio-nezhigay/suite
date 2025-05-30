import { RouteHandler } from 'gadget-server';
import { emails } from 'gadget-server';

interface SendEmailRequest {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  cc?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

const route: RouteHandler<{ Body: SendEmailRequest }> = async (context) => {
  const { logger, config, request, reply } = context;

  try {
    const { recipientEmail, subject, htmlContent, cc, attachments } =
      request.body;

    emails.setTransport({
      host: 'mail.adm.tools',
      port: 465,
      secure: true,
      auth: {
        user: 'info@informatica.com.ua',
        pass: config.EMAIL_PASSWORD,
      },
    });

    // Prepare email options
    const emailOptions: any = {
      from: 'info@informatica.com.ua',
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
    };

    // Add CC if provided
    if (cc) {
      emailOptions.cc = cc;
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailOptions.attachments = attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType || 'application/octet-stream',
      }));
    }

    // Send the email
    await emails.sendMail(emailOptions);

    logger.info(
      {
        recipientEmail,
        subject,
        cc: cc || null,
        attachmentCount: attachments?.length || 0,
      },
      'Email sent successfully'
    );

    await reply.code(200).send({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send email');

    await reply.code(500).send({
      success: false,
      message: 'Failed to send email',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Set up JSON Schema validation for the request body
route.options = {
  schema: {
    body: {
      type: 'object',
      properties: {
        recipientEmail: {
          type: 'string',
          format: 'email',
          description: "The recipient's email address",
        },
        subject: {
          type: 'string',
          minLength: 1,
          description: 'The email subject',
        },
        htmlContent: {
          type: 'string',
          minLength: 1,
          description: 'The HTML body content',
        },
        cc: {
          type: 'string',
          format: 'email',
          description: 'Optional CC email address',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string' },
              contentType: { type: 'string' },
            },
            required: ['filename', 'content'],
          },
          description: 'Optional array of email attachments',
        },
      },
      required: ['recipientEmail', 'subject', 'htmlContent'],
      additionalProperties: false,
    },
  },
};

export default route;
