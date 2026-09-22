/**
 * Environment-aware Redis key namespace for WhatsApp business state.
 * Prevents collision between staging and production environments.
 */
export type WhatsAppRedisEnv = 'production' | 'staging' | 'development';

const prefix = (env: WhatsAppRedisEnv): string =>
  env === 'production' ? 'whatsapp' : `${env}:whatsapp`;

export const whatsappRedisKeys = {
  chatHistory: (env: WhatsAppRedisEnv, phone: string) => `${prefix(env)}:chat_history:${phone}`,
  sessionMode: (env: WhatsAppRedisEnv, phone: string) => `${prefix(env)}:session_mode:${phone}`,
  customerNote: (env: WhatsAppRedisEnv, phone: string) => `${prefix(env)}:customer_note:${phone}`,
  allowedPhones: (env: WhatsAppRedisEnv) => `${prefix(env)}:allowed_phones`,
  lastEscalation: (env: WhatsAppRedisEnv, chatId: string) => `${prefix(env)}:last_escalation:${chatId}`,
} as const;

/**
 * Session mode values for whatsapp:session_mode Redis keys.
 * HUMAN = bot is muted, owner is responding manually.
 * BOT = normal AI-assisted mode (key absent or 'BOT').
 */
export type WhatsAppSessionMode = 'HUMAN' | 'BOT';
