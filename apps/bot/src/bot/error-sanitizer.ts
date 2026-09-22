/**
 * Error Sanitizer
 * Redacts sensitive tokens, API keys, passwords, phone numbers, and WhatsApp JIDs from log messages.
 */

export const MAX_API_ERROR_CHARS = 450;

export function toSafeErrorMessage(error: unknown, fallback: string): string {
  let message = fallback;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  const sanitized = message
    .replace(/(api[_-]?key|secret|token|password)=[^&\s]+/gi, '$1=[REDACTED]')
    .replace(/[a-zA-Z0-9_-]{20,}/g, '[REDACTED_TOKEN]')
    .replace(/(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g, '[PHONE]')
    .replace(/\b\d{10,}@s\.whatsapp\.net\b/g, '[JID]')
    .replace(/\b\d{10,}@lid\b/g, '[LID]');

  return sanitized.slice(0, MAX_API_ERROR_CHARS);
}
