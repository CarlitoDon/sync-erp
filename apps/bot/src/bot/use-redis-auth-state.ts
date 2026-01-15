/**
 * Redis-based Auth State for Baileys
 *
 * Stores WhatsApp session credentials in Redis for persistence across restarts.
 * Based on Baileys useMultiFileAuthState but with Redis backend.
 */
import Redis from 'ioredis';
import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  proto,
} from '@whiskeysockets/baileys';

const REDIS_KEY_PREFIX = 'baileys:auth:';
const CREDS_KEY = `${REDIS_KEY_PREFIX}creds`;

// Initialize Redis client
const getRedisClient = () => {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
};

/**
 * Custom auth state handler using Redis
 */
export async function useRedisAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const redis = getRedisClient();

  // Connect to Redis
  try {
    await redis.connect();
    // eslint-disable-next-line no-console
    console.log('[Redis] Connected for Baileys auth');
  } catch (err) {
    // Already connected or connecting
    if (
      (err as Error).message !==
      'Redis is already connecting/connected'
    ) {
      console.warn(
        '[Redis] Connection warning:',
        (err as Error).message
      );
    }
  }

  // Read credentials from Redis
  const readData = async (key: string): Promise<unknown> => {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  // Write data to Redis
  const writeData = async (
    key: string,
    data: unknown
  ): Promise<void> => {
    try {
      const str = JSON.stringify(data, BufferJSON.replacer);
      await redis.set(key, str);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Redis] Write error:', err);
    }
  };

  // Remove data from Redis
  const removeData = async (key: string): Promise<void> => {
    try {
      await redis.del(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Redis] Delete error:', err);
    }
  };

  // Load or initialize credentials
  let creds: AuthenticationCreds;
  const storedCreds = (await readData(
    CREDS_KEY
  )) as AuthenticationCreds;
  if (storedCreds) {
    creds = storedCreds;
    // eslint-disable-next-line no-console
    console.log('[Redis] Loaded existing credentials');
  } else {
    creds = initAuthCreds();
    // eslint-disable-next-line no-console
    console.log('[Redis] Initialized new credentials');
  }

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              const key = `${REDIS_KEY_PREFIX}${type}-${id}`;
              const value = await readData(key);
              if (value) {
                if (type === 'app-state-sync-key') {
                  data[id] =
                    proto.Message.AppStateSyncKeyData.fromObject(
                      value
                    ) as unknown as SignalDataTypeMap[T];
                } else {
                  data[id] = value as SignalDataTypeMap[T];
                }
              }
            })
          );
          return data;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: async (data: any): Promise<void> => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${REDIS_KEY_PREFIX}${category}-${id}`;
              const value = data[category][id];
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData(CREDS_KEY, creds);
    },
  };
}
