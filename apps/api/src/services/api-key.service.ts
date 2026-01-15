import { prisma } from '@sync-erp/database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export interface ApiKeyValidationResult {
  companyId: string;
  permissions: string[];
  keyId: string;
}

export interface CreateKeyResult {
  key: string;
  id: string;
  keyPrefix: string;
}

/**
 * Service for managing API keys for multi-tenant authentication
 */
export class ApiKeyService {
  private static instance: ApiKeyService;

  static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  /**
   * Generate a new API key for a company
   * @param companyId - The company ID to associate the key with
   * @param name - A friendly name for the key (e.g., "Production Key")
   * @param options - Optional configuration (webhookUrl, permissions, etc.)
   */
  async createKey(
    companyId: string,
    name: string,
    options?: {
      webhookUrl?: string;
      webhookSecret?: string;
      permissions?: string[];
      rateLimit?: number;
      expiresAt?: Date;
    }
  ): Promise<CreateKeyResult> {
    // Generate a secure random key with sk_ prefix
    const rawKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 11); // "sk_xxxxxxx"
    const keyHash = await bcrypt.hash(rawKey, 10);

    // Generate webhook secret if webhookUrl provided but no secret
    const webhookSecret =
      options?.webhookUrl && !options?.webhookSecret
        ? crypto.randomBytes(32).toString('hex')
        : options?.webhookSecret;

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        name,
        companyId,
        webhookUrl: options?.webhookUrl,
        webhookSecret,
        permissions: options?.permissions ?? [
          'rental:read',
          'rental:write',
        ],
        rateLimit: options?.rateLimit ?? 1000,
        expiresAt: options?.expiresAt,
      },
    });

    return {
      key: rawKey, // Only returned once, never stored
      id: apiKey.id,
      keyPrefix,
    };
  }

  /**
   * Create a key with a specific value (for backward compatibility migration)
   * WARNING: Only use for migrating existing keys
   */
  async createKeyWithValue(
    companyId: string,
    name: string,
    rawKey: string
  ): Promise<CreateKeyResult> {
    const keyPrefix = rawKey.substring(
      0,
      Math.min(11, rawKey.length)
    );
    const keyHash = await bcrypt.hash(rawKey, 10);

    const existing = await prisma.apiKey.findFirst({
      where: { companyId, name },
    });

    if (existing) {
      // Update existing key
      await prisma.apiKey.update({
        where: { id: existing.id },
        data: { keyHash, keyPrefix },
      });
      return { key: rawKey, id: existing.id, keyPrefix };
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        name,
        companyId,
      },
    });

    return { key: rawKey, id: apiKey.id, keyPrefix };
  }

  /**
   * Validate an API key and return the associated company context
   * @param rawKey - The raw API key from the Authorization header
   */
  async validateKey(
    rawKey: string
  ): Promise<ApiKeyValidationResult | null> {
    if (!rawKey || rawKey.length < 8) {
      return null;
    }

    const prefix = rawKey.substring(0, 11);

    // Find candidate keys by prefix (indexed for performance)
    const candidates = await prisma.apiKey.findMany({
      where: {
        keyPrefix: prefix,
        isActive: true,
      },
      select: {
        id: true,
        keyHash: true,
        companyId: true,
        permissions: true,
        expiresAt: true,
      },
    });

    // If no prefix match, try without prefix filter (for legacy keys)
    const keysToCheck =
      candidates.length > 0
        ? candidates
        : await prisma.apiKey.findMany({
            where: { isActive: true },
            select: {
              id: true,
              keyHash: true,
              companyId: true,
              permissions: true,
              expiresAt: true,
            },
          });

    for (const candidate of keysToCheck) {
      // Skip expired keys
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        continue;
      }

      // Verify the hash
      const isValid = await bcrypt.compare(rawKey, candidate.keyHash);
      if (isValid) {
        // Update last used timestamp (fire and forget)
        prisma.apiKey
          .update({
            where: { id: candidate.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {
            /* ignore */
          });

        return {
          companyId: candidate.companyId,
          permissions: candidate.permissions,
          keyId: candidate.id,
        };
      }
    }

    return null;
  }

  /**
   * Revoke an API key
   */
  async revokeKey(keyId: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
  }

  /**
   * List all API keys for a company (without exposing the actual key)
   */
  async listKeys(companyId: string) {
    return prisma.apiKey.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        webhookUrl: true,
        rateLimit: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update webhook configuration for an API key
   */
  async updateWebhook(
    keyId: string,
    webhookUrl: string | null,
    webhookSecret?: string
  ): Promise<void> {
    const secret =
      webhookUrl && !webhookSecret
        ? crypto.randomBytes(32).toString('hex')
        : webhookSecret;

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { webhookUrl, webhookSecret: secret },
    });
  }

  /**
   * Get webhook configuration for a company's active key
   */
  async getWebhookConfig(companyId: string) {
    return prisma.apiKey.findFirst({
      where: {
        companyId,
        isActive: true,
        webhookUrl: { not: null },
      },
      select: {
        webhookUrl: true,
        webhookSecret: true,
      },
    });
  }
}

// Singleton export for convenience
export const apiKeyService = ApiKeyService.getInstance();
