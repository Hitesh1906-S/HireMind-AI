import nodemailer, { type Transporter } from 'nodemailer';
import { EmailOptions, EmailProvider, EmailSendResult } from '../email.interface.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private transporter: Transporter | null = null;

  constructor() {
    if (env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_SECURE || false,
        auth: env.SMTP_USER
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS || '',
            }
          : undefined,
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    if (!this.transporter) {
      logger.warn(
        '[SMTP Provider Warning] SMTP_HOST not configured. Falling back to stdout simulation.'
      );
      logger.info(`[SMTP Fallback] To: ${options.to} | Subject: ${options.subject}`);
      return {
        success: true,
        messageId: `smtp-simulated-${Date.now()}`,
        provider: this.name,
      };
    }

    try {
      const fromAddress = options.from || env.EMAIL_FROM || 'HireMind AI <no-reply@hiremind.ai>';
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });

      return {
        success: true,
        messageId: info.messageId || `smtp-${Date.now()}`,
        provider: this.name,
      };
    } catch (err: any) {
      logger.error('[SMTP Provider Error]', err);
      return {
        success: false,
        messageId: '',
        provider: this.name,
        error: err.message || 'SMTP transmission failure',
      };
    }
  }
}
