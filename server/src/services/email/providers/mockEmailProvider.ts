import { EmailOptions, EmailProvider, EmailSendResult } from '../email.interface.js';

export interface QueuedMockEmail extends EmailOptions {
  messageId: string;
  sentAt: Date;
}

export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  private static sentQueue: QueuedMockEmail[] = [];

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    MockEmailProvider.sentQueue.push({
      ...options,
      messageId,
      sentAt: new Date(),
    });

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }

  static getSentEmails(): QueuedMockEmail[] {
    return [...this.sentQueue];
  }

  static getLatestEmail(): QueuedMockEmail | undefined {
    return this.sentQueue[this.sentQueue.length - 1];
  }

  static clear(): void {
    this.sentQueue = [];
  }
}
