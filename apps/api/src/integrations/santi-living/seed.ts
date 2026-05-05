
export async function seedSantiLiving(prisma: any, companyId: string) {
  const existingApp = await prisma.integration.findUnique({
    where: { companyId_appId: { companyId, appId: 'santi-living' } }
  });

  if (!existingApp) {
    await prisma.integration.create({
      data: {
        companyId,
        appId: 'santi-living',
        name: 'Santi Living',
        description: 'Santi Living integration',
        isActive: true,
        config: {
          webhookUrl: 'https://webhook.santi.living/api/orders',
          assetBaseUrl: 'https://storage.googleapis.com/santi-living-public',
        }
      }
    });
  }
}
