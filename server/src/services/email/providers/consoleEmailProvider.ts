import { EmailOptions, EmailProvider, EmailSendResult } from '../email.interface.js';
import { logger } from '../../../utils/logger.js';

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    logger.info(`[EMAIL DISPATCH] To: ${options.to} | Subject: ${options.subject} | ID: ${messageId}`);


    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }
}
