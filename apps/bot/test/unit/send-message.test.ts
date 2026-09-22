import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/sync_erp_test';
});

import { sendMessage, splitMessageBubbles } from '../../src/api/send-message';
import { getSocket, getStatus } from '../../src/bot/baileys';
import { isCustomerAllowed } from '../../src/utils/whitelist';
import { appendChatHistory } from '../../src/utils/chat-history';
import type { Request, Response } from 'express';

vi.mock('../../src/bot/baileys');
vi.mock('../../src/utils/whitelist', () => ({
  isCustomerAllowed: vi.fn(),
}));
vi.mock('../../src/utils/chat-history', () => ({
  appendChatHistory: vi.fn(),
}));

function makeResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function makeRequest(body: unknown) {
  return { body } as Request;
}

describe('splitMessageBubbles', () => {
  it('returns single bubble when no delimiter is present', () => {
    const text = 'halo kak 😊 ada yang bisa dibantu?';
    expect(splitMessageBubbles(text)).toEqual([text]);
  });

  it('splits message into 2 bubbles on \\n---\\n', () => {
    const text = 'halo kak 😊\n---\nrencana sewa mau kapan ya kak? kita cek kan stock nya';
    expect(splitMessageBubbles(text)).toEqual([
      'halo kak 😊',
      'rencana sewa mau kapan ya kak? kita cek kan stock nya',
    ]);
  });

  it('splits message into 3 bubbles', () => {
    const text = 'halo kak 😊\n---\nready kasur busa tebal 20cm\n---\nrencana sewa mau kapan ya kak?';
    expect(splitMessageBubbles(text)).toEqual([
      'halo kak 😊',
      'ready kasur busa tebal 20cm',
      'rencana sewa mau kapan ya kak?',
    ]);
  });

  it('handles CRLF line endings (\\r\\n---\\r\\n)', () => {
    const text = 'halo kak 😊\r\n---\r\nrencana sewa mau kapan ya kak?';
    expect(splitMessageBubbles(text)).toEqual([
      'halo kak 😊',
      'rencana sewa mau kapan ya kak?',
    ]);
  });

  it('handles spaces or extra dashes (e.g. \\n  -----  \\n)', () => {
    const text = 'halo kak 😊\n   -----\nrencana sewa mau kapan ya kak?';
    expect(splitMessageBubbles(text)).toEqual([
      'halo kak 😊',
      'rencana sewa mau kapan ya kak?',
    ]);
  });

  it('does NOT split on markdown list items starting with a single dash', () => {
    const text = 'Pilihan kasur:\n- Ukuran 90\n- Ukuran 120\n- Ukuran 160';
    expect(splitMessageBubbles(text)).toEqual([text]);
  });

  it('filters out empty segments from leading or trailing delimiters', () => {
    const text = '---\nhalo kak 😊\n---\n';
    expect(splitMessageBubbles(text)).toEqual(['halo kak 😊']);
  });

  it('handles literal escaped \\n delimiters (\\\\n---\\\\n)', () => {
    const text = 'halo kak 😊\\n---\\nrencana sewa mau kapan ya kak?';
    expect(splitMessageBubbles(text)).toEqual([
      'halo kak 😊',
      'rencana sewa mau kapan ya kak?',
    ]);
  });

  it('filters out empty array for literal escaped delimiter-only strings', () => {
    expect(splitMessageBubbles('---\\n---')).toEqual([]);
    expect(splitMessageBubbles('   \\n---\\n   ')).toEqual([]);
  });

  it('returns empty array for empty or whitespace-only strings', () => {
    expect(splitMessageBubbles('')).toEqual([]);
    expect(splitMessageBubbles('   \n\n  ')).toEqual([]);
    expect(splitMessageBubbles('---\n---')).toEqual([]);
  });
});

describe('sendMessage Handler', () => {
  const sendMessageMock = vi.fn();
  const sendPresenceUpdateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStatus).mockReturnValue('READY');
    vi.mocked(isCustomerAllowed).mockResolvedValue(true);
    sendMessageMock.mockResolvedValue({ key: { id: 'msg-123' } });
    sendPresenceUpdateMock.mockResolvedValue(undefined);

    vi.mocked(getSocket).mockReturnValue({
      sendMessage: sendMessageMock,
      sendPresenceUpdate: sendPresenceUpdateMock,
    } as unknown as ReturnType<typeof getSocket>);
  });

  it('explicitly disables linkPreview to contain SSRF egress on single message', async () => {
    const req = makeRequest({
      phone: '08123456789',
      message: 'Check this: http://evil.com',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith(
      '628123456789@s.whatsapp.net',
      expect.objectContaining({
        text: 'Check this: http://evil.com',
        linkPreview: null,
      })
    );
    expect(appendChatHistory).toHaveBeenCalledWith(
      '08123456789',
      expect.objectContaining({
        role: 'assistant',
        text: 'Check this: http://evil.com',
      })
    );
  });

  it('delivers multi-bubble messages sequentially with linkPreview null on every bubble', async () => {
    const req = makeRequest({
      phone: '08123456789',
      message: 'halo kak 😊\n---\nrencana sewa mau kapan ya kak? kita cek kan stock nya',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        bubbleCount: 2,
        messageId: 'msg-123',
      })
    );

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      1,
      '628123456789@s.whatsapp.net',
      {
        text: 'halo kak 😊',
        linkPreview: null,
      }
    );
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      '628123456789@s.whatsapp.net',
      {
        text: 'rencana sewa mau kapan ya kak? kita cek kan stock nya',
        linkPreview: null,
      }
    );

    // Verifies each bubble is stored in chat history
    expect(appendChatHistory).toHaveBeenCalledTimes(2);
    expect(appendChatHistory).toHaveBeenNthCalledWith(
      1,
      '08123456789',
      expect.objectContaining({
        role: 'assistant',
        text: 'halo kak 😊',
      })
    );
    expect(appendChatHistory).toHaveBeenNthCalledWith(
      2,
      '08123456789',
      expect.objectContaining({
        role: 'assistant',
        text: 'rencana sewa mau kapan ya kak? kita cek kan stock nya',
      })
    );

    // Verifies presence update is called and reset to available
    expect(sendPresenceUpdateMock).toHaveBeenCalledWith(
      'available',
      '628123456789@s.whatsapp.net'
    );
  });

  it('rejects numbers not allowed by whitelist (Wife-Only guardrail)', async () => {
    vi.mocked(isCustomerAllowed).mockResolvedValue(false);

    const req = makeRequest({
      phone: '08123456789',
      message: 'halo kak',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('rejects sending automated sales message to internal staff (Admin 1 +6281249182155)', async () => {
    vi.mocked(isCustomerAllowed).mockResolvedValue(true); // Even if whitelist returned true

    const req = makeRequest({
      phone: '081249182155', // Admin 1
      message: 'halo kak',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('staf internal'),
      })
    );
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('rejects invalid phone numbers', async () => {
    const req = makeRequest({
      phone: '12345',
      message: 'halo kak',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('rejects empty or whitespace-only messages', async () => {
    const req = makeRequest({
      phone: '08123456789',
      message: '   \n---\n   ',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('returns 503 when bot is not ready', async () => {
    vi.mocked(getStatus).mockReturnValue('INITIALIZING');

    const req = makeRequest({
      phone: '08123456789',
      message: 'halo kak',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('handles partial delivery failure gracefully and reports sentMessageIds', async () => {
    // Bubble 1 succeeds, Bubble 2 throws
    sendMessageMock
      .mockResolvedValueOnce({ key: { id: 'msg-part-1' } })
      .mockRejectedValueOnce(new Error('Network connection reset'));

    const req = makeRequest({
      phone: '08123456789',
      message: 'halo kak 😊\n---\nrencana sewa mau kapan ya kak?',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Delivery Failed',
        message: 'Network connection reset',
        sentMessageIds: ['msg-part-1'],
      })
    );
    // Verifies first bubble was recorded before failure
    expect(appendChatHistory).toHaveBeenCalledTimes(1);
    expect(appendChatHistory).toHaveBeenCalledWith(
      '08123456789',
      expect.objectContaining({
        text: 'halo kak 😊',
      })
    );
    // Verifies presence was reset to available even after failure
    expect(sendPresenceUpdateMock).toHaveBeenCalledWith(
      'available',
      '628123456789@s.whatsapp.net'
    );
  });

  it('continues message delivery even if sendPresenceUpdate throws', async () => {
    sendPresenceUpdateMock.mockRejectedValue(new Error('Presence update not supported'));

    const req = makeRequest({
      phone: '08123456789',
      message: 'halo kak 😊',
    });
    const res = makeResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });
});
