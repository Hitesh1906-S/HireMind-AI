import { EmailOptions, EmailProvider, EmailSendResult } from '../email.interface.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn('[Resend Provider] RESEND_API_KEY not configured. Falling back to stdout simulation.');
      logger.info(`[Resend Fallback] To: ${options.to} | Subject: ${options.subject}`);
      return {
        success: true,
        messageId: `resend-simulated-${Date.now()}`,
        provider: this.name,
      };
    }

    try {
      const fromAddress = options.from || env.EMAIL_FROM || 'onboarding@resend.dev';
      const payload = {
        from: fromAddress,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      };

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(`Resend API error (${res.status}): ${JSON.stringify(data)}`);
      }

      return {
        success: true,
        messageId: data.id || `resend-${Date.now()}`,
        provider: this.name,
      };
    } catch (err: any) {
      logger.error('[Resend Provider Error]', err);
      return {
        success: false,
        messageId: '',
        provider: this.name,
        error: err.message || 'Resend API dispatch failed',
      };
    }
  }
}
