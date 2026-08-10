import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  generateWAMessageContent,
  type AnyRegularMessageContent,
  type WAMediaUploadFunction,
} from '@whiskeysockets/baileys';
import type { Request, Response } from 'express';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { socket } = vi.hoisted(() => ({
  socket: {
    onWhatsApp: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock('../src/bot/baileys', () => ({
  getSocket: () => socket,
  getStatus: () => 'READY',
}));

const { sendOrder } = await import('../src/api/send-order');
const { botRouter } = await import('../src/trpc/routers/bot.router');

const BOT_SECRET = 'send-order-ssrf-containment-secret';
const originalBotSecret = process.env.SYNC_ERP_BOT_SECRET;

const basePayload = {
  orderId: 'order-ssrf-containment',
  customerName: 'Test Customer',
  customerWhatsapp: '081234567890',
  deliveryAddress: 'Jl. Test No. 1, Jakarta',
  items: [
    {
      id: 'item-1',
      name: 'Kasur Test',
      category: 'mattress' as const,
      quantity: 1,
      pricePerDay: 100_000,
    },
  ],
  totalPrice: 100_000,
  orderDate: '2026-08-09T00:00:00.000Z',
  endDate: '2026-08-10T00:00:00.000Z',
  duration: 1,
  deliveryFee: 0,
};

function makeResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeRequest(body: unknown) {
  return { body } as Request;
}

function createBotCaller(authorization = `Bearer ${BOT_SECRET}`) {
  return botRouter.createCaller({
    req: {
      headers: { authorization },
    } as unknown as Request,
    res: {} as Response,
  });
}

const noNetworkUpload: WAMediaUploadFunction = async () => {
  throw new Error('Media upload must not be called for a text message');
};

async function generateContentWithoutPreviewResolution(
  message: AnyRegularMessageContent
) {
  const resolver = vi.fn(async () => {
    throw new Error('URL resolver must not be called');
  });
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  const content = await generateWAMessageContent(message, {
    getUrlInfo: resolver,
    upload: noNetworkUpload,
  });

  expect(resolver).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();

  return content;
}

describe('send-order SSRF containment', () => {
  beforeEach(() => {
    process.env.SYNC_ERP_BOT_SECRET = BOT_SECRET;
    socket.onWhatsApp.mockReset();
    socket.sendMessage.mockReset();
    socket.onWhatsApp.mockResolvedValue([{ exists: true }]);
    socket.sendMessage.mockResolvedValue({ key: { id: 'message-id' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    if (originalBotSecret === undefined) {
      delete process.env.SYNC_ERP_BOT_SECRET;
    } else {
      process.env.SYNC_ERP_BOT_SECRET = originalBotSecret;
    }
  });

  it('explicitly disables Baileys previews across order senders', () => {
    for (const sourcePath of [
      '../src/api/send-order.ts',
      '../src/trpc/routers/bot.router.ts',
    ]) {
      const source = readFileSync(
        fileURLToPath(new URL(sourcePath, import.meta.url)),
        'utf8'
      );

      expect(source).not.toContain('getUrlInfo');
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toContain('orderUrl');
      expect(source).toMatch(/linkPreview:\s*null/);
    }
  });

  it('proves the installed Baileys resolver decision path is exercised only when preview is omitted', async () => {
    const url = 'https://resolver-control.example/order';
    const resolver = vi.fn(async () => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await generateWAMessageContent(
      { text: url },
      {
        getUrlInfo: resolver,
        upload: noNetworkUpload,
      }
    );

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith(url);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    'http://127.0.0.1/admin',
    'http://10.0.0.1/internal',
    'http://[::1]/admin',
    'http://169.254.169.254/latest/meta-data',
    'https://public.example/redirect?to=http%3A%2F%2F127.0.0.1%2F',
    'https://rebind.example/order?target=169.254.169.254',
  ])(
    'sends %s as literal text with Baileys preview resolution disabled',
    async (orderUrl) => {
      const response = makeResponse();

      await sendOrder(
        makeRequest({ ...basePayload, orderUrl }),
        response
      );

      expect(response.status).toHaveBeenCalledWith(200);
      expect(socket.onWhatsApp).toHaveBeenCalledTimes(1);
      expect(socket.sendMessage).toHaveBeenCalledTimes(1);
      expect(socket.sendMessage).toHaveBeenCalledWith(
        '6281234567890@s.whatsapp.net',
        {
          text: expect.stringContaining(orderUrl),
          linkPreview: null,
        }
      );
      const sentMessage = socket.sendMessage.mock.calls[0]?.[1] as
        | AnyRegularMessageContent
        | undefined;
      expect(sentMessage).toEqual({
        text: expect.stringContaining(orderUrl),
        linkPreview: null,
      });

      const content = await generateContentWithoutPreviewResolution(
        sentMessage as AnyRegularMessageContent
      );
      expect(content.extendedTextMessage?.text).toContain(orderUrl);
      expect(content.extendedTextMessage?.matchedText).toBeUndefined();
    }
  );

  it('keeps normal order sending and the literal tracking URL contract', async () => {
    const orderUrl = 'https://sync-erp.com/orders/order-ssrf-containment';
    const response = makeResponse();

    await sendOrder(
      makeRequest({ ...basePayload, orderUrl }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      messageId: 'message-id',
    });
    expect(socket.sendMessage.mock.calls[0]?.[1]).toEqual({
      text: expect.stringContaining(orderUrl),
      linkPreview: null,
    });
    await generateContentWithoutPreviewResolution(
      socket.sendMessage.mock.calls[0]?.[1] as AnyRegularMessageContent
    );
  });

  it('keeps authenticated tRPC order sending as literal text with preview resolution disabled', async () => {
    const orderUrl = 'http://169.254.169.254/latest/meta-data';

    await expect(
      createBotCaller().sendOrder({ ...basePayload, orderUrl })
    ).resolves.toEqual({ success: true, messageId: 'message-id' });

    const sentMessage = socket.sendMessage.mock.calls[0]?.[1] as
      | AnyRegularMessageContent
      | undefined;
    expect(sentMessage).toEqual({
      text: expect.stringContaining(orderUrl),
      linkPreview: null,
    });
    await generateContentWithoutPreviewResolution(
      sentMessage as AnyRegularMessageContent
    );
  });

  it('keeps tRPC bot authentication enforced', async () => {
    await expect(
      createBotCaller('').sendOrder(basePayload)
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(socket.onWhatsApp).not.toHaveBeenCalled();
    expect(socket.sendMessage).not.toHaveBeenCalled();
  });

  it('preserves invalid orderUrl validation before any delivery work', async () => {
    const response = makeResponse();

    await sendOrder(
      makeRequest({ ...basePayload, orderUrl: 'not-a-url' }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(socket.onWhatsApp).not.toHaveBeenCalled();
    expect(socket.sendMessage).not.toHaveBeenCalled();
  });
});
