import { prisma } from '@sync-erp/database';

async function main() {
  console.log('🔍 Starting API Key Cleanup...');

  const keys = await prisma.apiKey.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  const groups = new Map<string, typeof keys>();

  // Group by companyId + keyPrefix
  for (const key of keys) {
    const groupKey = `${key.companyId}:${key.keyPrefix}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)?.push(key);
  }

  let deletedCount = 0;

  for (const [groupKey, groupKeys] of groups.entries()) {
    if (groupKeys.length > 1) {
      console.log(
        `Found ${groupKeys.length} keys for group ${groupKey}`
      );

      // Sort:
      // 1. lastUsedAt desc (prioritize used keys)
      // 2. createdAt desc (prioritize newer keys)
      groupKeys.sort((a, b) => {
        const aUsed = a.lastUsedAt?.getTime() ?? 0;
        const bUsed = b.lastUsedAt?.getTime() ?? 0;
        if (aUsed !== bUsed) return bUsed - aUsed;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      // Keep the first one
      const toKeep = groupKeys[0];
      const toDelete = groupKeys.slice(1);

      console.log(
        `  ✅ Keeping: ${toKeep.id} (Name: ${toKeep.name}, Last Used: ${toKeep.lastUsedAt ?? 'Never'})`
      );

      for (const key of toDelete) {
        console.log(
          `  ❌ Deleting: ${key.id} (Name: ${key.name}, Created: ${key.createdAt})`
        );
        await prisma.apiKey.delete({
          where: { id: key.id },
        });
        deletedCount++;
      }
    }
  }

  console.log('------------------------------------------------');
  console.log(
    `🎉 Cleanup complete. Deleted ${deletedCount} duplicate keys.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
