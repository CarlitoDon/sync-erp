import { beforeEach, describe, expect, it } from 'vitest';
import { apiKeyService } from '@src/services/api-key.service';
import { integrationService } from '@src/services/integration.service';
import { mockPrisma, resetMocks } from './mocks/prisma.mock';

describe('integration API-key rotation', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('preserves delivery settings and deactivates all previous active keys atomically', async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      webhookUrl: 'https://example.test/webhook',
      webhookSecret: 'internal-only-webhook-secret',
      rateLimit: 700,
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    });
    mockPrisma.apiKey.create.mockResolvedValue({ id: 'replacement-key-id' });

    const result = await apiKeyService.rotateKey(
      'rotation-company',
      'rotation-integration',
      'Storefront Key - rotation',
      { permissions: ['rental:read'] }
    );

    expect(result).toEqual({
      id: 'replacement-key-id',
      keyPrefix: expect.stringMatching(/^sk_/),
      key: expect.stringMatching(/^sk_[a-f0-9]{48}$/),
    });
    expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'rotation-company',
        integrationId: 'rotation-integration',
        permissions: ['rental:read'],
        webhookUrl: 'https://example.test/webhook',
        webhookSecret: 'internal-only-webhook-secret',
        rateLimit: 700,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      }),
    });
    expect(mockPrisma.apiKey.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: 'rotation-company',
        integrationId: 'rotation-integration',
        isActive: true,
        id: { not: 'replacement-key-id' },
      },
      data: { isActive: false },
    });
  });

  it('does not disclose key hashes or webhook secrets from integration details', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      id: 'safe-integration',
      companyId: 'rotation-company',
      appId: 'custom-storefront',
      name: 'Storefront',
      description: null,
      icon: null,
      isActive: true,
      config: {
        webhookSecret: 'config-secret',
        nested: { apiToken: 'nested-secret', visible: true },
        publicValue: 'safe',
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      apiKeys: [
        {
          id: 'safe-key',
          name: 'Storefront Key',
          keyPrefix: 'sk_safe',
          permissions: ['rental:read'],
          webhookUrl: 'https://example.test/webhook',
          rateLimit: 1000,
          isActive: true,
          expiresAt: null,
          lastUsedAt: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          keyHash: 'hash-must-not-return',
          webhookSecret: 'secret-must-not-return',
        },
      ],
    } as never);

    const result = await integrationService.getIntegration(
      'rotation-company',
      'safe-integration'
    );
    const query = mockPrisma.integration.findUnique.mock.calls[0]?.[0];

    expect(JSON.stringify(query?.select)).not.toContain('keyHash');
    expect(JSON.stringify(query?.select)).not.toContain('webhookSecret');
    expect(result.config).toEqual({
      nested: { visible: true },
      publicValue: 'safe',
    });
    expect(result.apiKeys[0]).not.toHaveProperty('keyHash');
    expect(result.apiKeys[0]).not.toHaveProperty('webhookSecret');
  });

  it('keeps repeat install responses secret-safe for legacy integration config', async () => {
    mockPrisma.integration.findUnique
      .mockResolvedValueOnce({ id: 'legacy-integration' })
      .mockResolvedValueOnce({
        id: 'legacy-integration',
        companyId: 'rotation-company',
        appId: 'custom-storefront',
        name: 'Storefront',
        description: null,
        icon: null,
        config: {
          webhookSecret: 'legacy-config-secret',
          visible: true,
        },
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        apiKeys: [
          {
            id: 'legacy-key',
            name: 'Storefront Key',
            keyPrefix: 'sk_legacy',
            permissions: ['rental:read'],
            webhookUrl: 'https://example.test/webhook',
            rateLimit: 1000,
            isActive: true,
            expiresAt: null,
            lastUsedAt: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            keyHash: 'legacy-hash',
            webhookSecret: 'legacy-key-secret',
          },
        ],
      } as never);
    mockPrisma.integration.update.mockResolvedValue({
      id: 'legacy-integration',
    });

    const result = await integrationService.install(
      'rotation-company',
      'custom-storefront'
    );

    expect(result.config).toEqual({ visible: true });
    expect(result.apiKeys[0]).not.toHaveProperty('keyHash');
    expect(result.apiKeys[0]).not.toHaveProperty('webhookSecret');
  });
});
