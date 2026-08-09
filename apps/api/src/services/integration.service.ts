import { prisma } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { Prisma } from '@sync-erp/database';

type IntegrationWithApiKeys = {
  id: string;
  companyId: string;
  appId: string;
  config: Prisma.JsonValue | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  apiKeys: Array<{
    id: string;
    keyPrefix: string;
    lastUsedAt: Date | null;
  }>;
};

const SENSITIVE_CONFIG_KEY = /(secret|token|password|private.?key|api.?key)/i;

function redactIntegrationConfig(
  value: Prisma.JsonValue | null | undefined
): Prisma.JsonValue | null | undefined {
  if (Array.isArray(value)) {
    return value.map((entry) => redactIntegrationConfig(entry) ?? null);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_CONFIG_KEY.test(key))
        .map(([key, entry]) => [
          key,
          redactIntegrationConfig(entry as Prisma.JsonValue) ?? null,
        ])
    ) as Prisma.JsonObject;
  }

  return value;
}

export interface IntegrationApp {
  appId: string;
  name: string;
  description: string;
  icon: string;
  defaultConfig?: Record<string, unknown>;
}

export const AVAILABLE_INTEGRATIONS: IntegrationApp[] = [
  {
    appId: 'custom-storefront',
    name: 'Custom Storefront',
    description:
      'Connect an external storefront, website, or marketplace through Sync ERP API v1.',
    icon: 'CubeIcon',
    defaultConfig: {
      webhookUrl: '',
      syncEnabled: true,
      apiBasePath: '/api/v1',
      trpcBasePath: '/api/trpc/integration/v1',
    },
  },
  {
    appId: 'rockhouse',
    name: 'Rockhouse',
    description: 'Event equipment rental management system.',
    icon: 'SpeakerWaveIcon',
  },
  {
    appId: 'pos-lite',
    name: 'POS Lite',
    description: 'Simple Point of Sale for retail transactions.',
    icon: 'ComputerDesktopIcon',
  },
];

export class IntegrationService {
  private static instance: IntegrationService;

  static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService();
    }
    return IntegrationService.instance;
  }

  /**
   * List available apps combined with installation status for a company
   */
  async listIntegrations(companyId: string) {
    const installed = (await prisma.integration.findMany({
      where: { companyId },
      include: {
        apiKeys: {
          where: { isActive: true },
          select: { id: true, keyPrefix: true, lastUsedAt: true },
          take: 1,
        },
      },
    })) as IntegrationWithApiKeys[];

    return AVAILABLE_INTEGRATIONS.map((app) => {
      const existing = installed.find(
        (i: IntegrationWithApiKeys) => i.appId === app.appId
      );
      return {
        ...app,
        isInstalled: !!existing,
        installation: existing
          ? {
              id: existing.id,
              isActive: existing.isActive,
              config: redactIntegrationConfig(existing.config),
              apiKey: existing.apiKeys[0] || null,
              updatedAt: existing.updatedAt,
            }
          : null,
      };
    });
  }

  /**
   * Get the active integration for a company with its first active API key
   */
  async getActiveIntegrationForCompany(companyId: string) {
    return prisma.integration.findFirst({
      where: { companyId, isActive: true },
      include: {
        apiKeys: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Install an integration (Create record + Initial API Key)
   */
  async install(companyId: string, appId: string) {
    const appDef = AVAILABLE_INTEGRATIONS.find(
      (a) => a.appId === appId
    );
    if (!appDef) {
      throw new DomainError(
        `App ${appId} not found in marketplace`,
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    // Check if already installed
    const existing = await prisma.integration.findUnique({
      where: { companyId_appId: { companyId, appId } },
    });

    if (existing) {
      // Re-activate if was inactive
      await prisma.integration.update({
        where: { id: existing.id },
        data: { isActive: true },
      });

      // Return the same secret-safe shape as the detail endpoint. Existing
      // records may contain legacy sensitive config values.
      return this.getIntegration(companyId, existing.id);
    }

    const integration = await prisma.$transaction(async (tx) => {
      // 1. Create Integration Record
      const integration = await tx.integration.create({
        data: {
          companyId,
          appId,
          name: appDef.name,
          description: appDef.description,
          icon: appDef.icon,
          config: (appDef.defaultConfig as Prisma.JsonValue) || {},
          isActive: true,
        },
      });

      // 2. Create Initial API Key
      // We use the apiKeyService logic but inside this transaction
      // Since apiKeyService.createKey is not transactional by default, we'll invoke it after
      // or we can just use the Service logic here if we want atomic
      // For simplicity, we'll create the key record directly here to ensure atomicity
      // or call the service if we trust it won't fail often.
      // Let's call the service AFTER (or modify service to accept tx, but that's complex)

      // Let's just return the integration and let the controller handle key creation
      // OR we just create it here.

      return integration;
    });

    return this.getIntegration(companyId, integration.id);
  }

  /**
   * Create a Custom Integration
   */
  async createCustom(
    companyId: string,
    data: { name: string; description?: string }
  ) {
    const appId = `custom-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;

    return prisma.integration.create({
      data: {
        companyId,
        appId,
        name: data.name,
        description: data.description,
        icon: 'CodeBracketIcon', // Default icon for custom apps
        isActive: true,
        config: {},
      },
    });
  }

  /**
   * Get details of an installed integration
   */
  async getIntegration(companyId: string, integrationId: string) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      select: {
        id: true,
        companyId: true,
        appId: true,
        name: true,
        description: true,
        icon: true,
        config: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        apiKeys: {
          orderBy: { createdAt: 'desc' },
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
            updatedAt: true,
          },
        },
      },
    });

    if (!integration || integration.companyId !== companyId) {
      throw new DomainError(
        'Integration not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return {
      ...integration,
      config: redactIntegrationConfig(integration.config),
      apiKeys: integration.apiKeys.map(
        ({
          id,
          name,
          keyPrefix,
          permissions,
          webhookUrl,
          rateLimit,
          isActive,
          expiresAt,
          lastUsedAt,
          createdAt,
          updatedAt,
        }) => ({
          id,
          name,
          keyPrefix,
          permissions,
          webhookUrl,
          rateLimit,
          isActive,
          expiresAt,
          lastUsedAt,
          createdAt,
          updatedAt,
        })
      ),
    };
  }

  /**
   * Update configuration
   */
  async updateConfig(
    companyId: string,
    integrationId: string,
    config: Record<string, unknown>,
    isActive?: boolean
  ) {
    const access = await prisma.integration.findFirst({
      where: { id: integrationId, companyId },
    });

    if (!access) {
      throw new DomainError(
        'Integration not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return prisma.integration.update({
      where: { id: integrationId },
      data: {
        config: config as Prisma.InputJsonValue,
        isActive: isActive ?? undefined,
      },
    });
  }
}

export const integrationService = IntegrationService.getInstance();
