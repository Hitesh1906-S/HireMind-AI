import { env } from '../config/env.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'audit';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'apikey',
  'gemini_api_key',
  'secret',
  'jwt_secret',
  'cookie',
];

function maskSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[Depth Exceeded]';
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      // Redact potential Bearer tokens or JWTs
      if (/^bearer\s+[a-zA-Z0-9._-]+$/i.test(obj.trim())) {
        return 'Bearer [REDACTED]';
      }
      if (/^[a-zA-Z0-9\-_]{20,}\.[a-zA-Z0-9\-_]{20,}\.[a-zA-Z0-9\-_]{20,}$/.test(obj.trim())) {
        return '[REDACTED_JWT]';
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = maskSensitiveData(value, depth + 1);
    } else if (typeof value === 'string') {
      sanitized[key] = maskSensitiveData(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
  }

  info(message: string, ...args: unknown[]) {
    const sanitizedArgs = args.map((arg) => maskSensitiveData(arg));
    console.log(this.formatMessage('info', message), ...sanitizedArgs);
  }

  warn(message: string, ...args: unknown[]) {
    const sanitizedArgs = args.map((arg) => maskSensitiveData(arg));
    console.warn(this.formatMessage('warn', message), ...sanitizedArgs);
  }

  error(message: string, ...args: unknown[]) {
    const sanitizedArgs = args.map((arg) => maskSensitiveData(arg));
    console.error(this.formatMessage('error', message), ...sanitizedArgs);
  }

  debug(message: string, ...args: unknown[]) {
    if (env.NODE_ENV !== 'production') {
      const sanitizedArgs = args.map((arg) => maskSensitiveData(arg));
      console.debug(this.formatMessage('debug', message), ...sanitizedArgs);
    }
  }

  audit(action: string, metadata: Record<string, unknown> = {}) {
    const sanitized = maskSensitiveData(metadata);
    const entry = {
      auditTimestamp: new Date().toISOString(),
      action,
      ...((typeof sanitized === 'object' && sanitized !== null) ? sanitized : { meta: sanitized }),
    };
    console.info(this.formatMessage('audit', JSON.stringify(entry)));
  }
}

export const logger = new Logger();

