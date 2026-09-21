import { describe, it, expect, vi } from 'vitest';
import { appendChatHistory, getFormattedChatHistory } from './chat-history';

// Mock getRedisClient
const mockStore: Record<string, string[]> = {};
vi.mock('../bot/use-redis-auth-state', () => ({
  getRedisClient: () => ({
    rpush: vi.fn(async (key: string, val: string) => {
      if (!mockStore[key]) mockStore[key] = [];
      mockStore[key].push(val);
      return mockStore[key].length;
    }),
    ltrim: vi.fn(async (key: string, start: number, stop: number) => {
      if (mockStore[key]) {
        mockStore[key] = mockStore[key].slice(start, stop === -1 ? undefined : stop + 1);
      }
      return 'OK';
    }),
    expire: vi.fn(async () => 1),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = mockStore[key] || [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    }),
  }),
}));

describe('Chat History Utility', () => {
  it('appends messages and formats chat history correctly', async () => {
    const phone = '6282258908353';
    await appendChatHistory(phone, {
      role: 'customer',
      name: 'Mila',
      text: 'halo k',
      timestamp: '2026-09-20T12:25:00Z',
    });

    await appendChatHistory(phone, {
      role: 'assistant',
      name: 'Carla',
      text: 'Halo kak! Selamat malam, ada yang bisa dibantu?',
      timestamp: '2026-09-20T12:28:00Z',
    });

    const formatted = await getFormattedChatHistory(phone);
    expect(formatted).toContain('Mila: halo k');
    expect(formatted).toContain('Carla: Halo kak! Selamat malam, ada yang bisa dibantu?');
  });

  it('returns placeholder when history is empty', async () => {
    const formatted = await getFormattedChatHistory('628999999999');
    expect(formatted).toBe('(Percakapan baru - belum ada riwayat sebelumnya)');
  });
});
