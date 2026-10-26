import { EmailOptions, EmailProvider, EmailSendResult, SupportedEmailProvider } from './email.interface.js';
import { ConsoleEmailProvider } from './providers/consoleEmailProvider.js';
import { MockEmailProvider } from './providers/mockEmailProvider.js';
import { SmtpEmailProvider } from './providers/smtpEmailProvider.js';
import { SendGridEmailProvider } from './providers/sendgridEmailProvider.js';
import { ResendEmailProvider } from './providers/resendEmailProvider.js';
import { env } from '../../config/env.js';

export class EmailService {
  private static activeProvider: EmailProvider | null = null;
  private static registeredProviders: Map<string, EmailProvider> = new Map();

  /**
   * Initializes or resolves the configured email provider.
   * Do not hardcode an email provider — configurable via EMAIL_PROVIDER environment variable.
   */
  static getProvider(): EmailProvider {
    if (this.activeProvider) {
      return this.activeProvider;
    }

    const providerType = (env.EMAIL_PROVIDER || 'console').toLowerCase() as SupportedEmailProvider;

    switch (providerType) {
      case 'smtp':
        this.activeProvider = new SmtpEmailProvider();
        break;
      case 'sendgrid':
        this.activeProvider = new SendGridEmailProvider();
        break;
      case 'resend':
        this.activeProvider = new ResendEmailProvider();
        break;
      case 'mock':
        this.activeProvider = new MockEmailProvider();
        break;
      case 'console':
      default:
        this.activeProvider = new ConsoleEmailProvider();
        break;
    }

    return this.activeProvider;
  }

  /**
   * Override or register custom email provider (e.g. for testing, SES, Mailgun, Postmark)
   */
  static setProvider(provider: EmailProvider): void {
    this.activeProvider = provider;
  }

  /**
   * Send an email through the active provider abstraction.
   * Safe execution: logs transmission details without crashing callers if delivery fails.
   */
  static async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    try {
      const provider = this.getProvider();
      const result = await provider.sendEmail(options);
      return result;
    } catch (err: any) {
      console.error(`[EmailService Error] Failed to send email to ${options.to}:`, err);
      return {
        success: false,
        messageId: '',
        provider: this.activeProvider?.name || 'unknown',
        error: err.message || 'Email delivery exception',
      };
    }
  }
}
