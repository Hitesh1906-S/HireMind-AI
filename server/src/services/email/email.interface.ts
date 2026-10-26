export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  messageId: string;
  provider: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(options: EmailOptions): Promise<EmailSendResult>;
}

export type SupportedEmailProvider = 'console' | 'smtp' | 'sendgrid' | 'resend' | 'mock';
