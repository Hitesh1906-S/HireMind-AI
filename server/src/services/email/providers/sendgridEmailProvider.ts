import { EmailOptions, EmailProvider, EmailSendResult } from '../email.interface.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const apiKey = env.SENDGRID_API_KEY;
    if (!apiKey) {
      logger.warn('[SendGrid Provider] SENDGRID_API_KEY not configured. Falling back to stdout simulation.');
      logger.info(`[SendGrid Fallback] To: ${options.to} | Subject: ${options.subject}`);
      return {
        success: true,
        messageId: `sendgrid-simulated-${Date.now()}`,
        provider: this.name,
      };
    }

    try {
      const fromAddress = options.from || env.EMAIL_FROM || 'HireMind AI <no-reply@hiremind.ai>';
      const payload = {
        personalizations: [
          {
            to: [{ email: options.to }],
            subject: options.subject,
          },
        ],
        from: {
          email: fromAddress.includes('<')
            ? fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress
            : fromAddress,
          name: fromAddress.includes('<')
            ? fromAddress.split('<')[0].trim()
            : 'HireMind AI',
        },
        content: [
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          { type: 'text/html', value: options.html },
        ],
      };

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`SendGrid API error (${res.status}): ${errorText}`);
      }

      const messageId = res.headers.get('x-message-id') || `sendgrid-${Date.now()}`;
      return {
        success: true,
        messageId,
        provider: this.name,
      };
    } catch (err: any) {
      logger.error('[SendGrid Provider Error]', err);
      return {
        success: false,
        messageId: '',
        provider: this.name,
        error: err.message || 'SendGrid API dispatch failed',
      };
    }
  }
}
