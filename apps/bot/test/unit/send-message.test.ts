import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendMessage } from '../../src/api/send-message';
import { getSocket, getStatus } from '../../src/bot/baileys';
import { Request, Response } from 'express';

vi.mock('../../src/bot/baileys');

describe('sendMessage Egress', () => {
  const sendMessageMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStatus).mockReturnValue('READY');
    vi.mocked(getSocket).mockReturnValue({
      sendMessage: sendMessageMock,
    } as unknown as ReturnType<typeof getSocket>);
  });

  it('explicitly disables linkPreview to contain SSRF egress', async () => {
    const req = {
      body: { phone: '08123456789', message: 'Check this: http://evil.com' },
    } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    await sendMessage(req, res);

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        text: 'Check this: http://evil.com',
        linkPreview: null,
      })
    );
  });
});
