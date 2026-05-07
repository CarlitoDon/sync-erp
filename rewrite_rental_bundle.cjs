const fs = require('fs');

// rental-bundle.service.ts
let serviceContent = fs.readFileSync('apps/api/src/modules/rental/rental-bundle.service.ts', 'utf8');

serviceContent = serviceContent.replace('export interface SyncFromSantiLivingInput {', 'export interface SyncExternalBundlesInput {');
serviceContent = serviceContent.replace('export async function syncFromSantiLiving(', 'export async function syncExternalBundles(');
serviceContent = serviceContent.replace('input: SyncFromSantiLivingInput', 'input: SyncExternalBundlesInput');
serviceContent = serviceContent.replace('// Sync from Santi Living', '// Sync External Bundles');

fs.writeFileSync('apps/api/src/modules/rental/rental-bundle.service.ts', serviceContent);

// rental-bundle.router.ts
let routerContent = fs.readFileSync('apps/api/src/trpc/routers/rental-bundle.router.ts', 'utf8');

routerContent = routerContent.replace('syncFromSantiLiving: publicProcedure', 'syncExternalBundles: publicProcedure');
routerContent = routerContent.replace('bundleService.syncFromSantiLiving(input)', 'bundleService.syncExternalBundles(input)');
routerContent = routerContent.replace('// Sync bundles from santi-living products.json', '// Sync external bundles');

fs.writeFileSync('apps/api/src/trpc/routers/rental-bundle.router.ts', routerContent);

// RentalBundlesPage.tsx
let pageContent = fs.readFileSync('apps/web/src/features/rental/pages/RentalBundlesPage.tsx', 'utf8');

pageContent = pageContent.replace('trpc.rentalBundle.syncFromSantiLiving.useMutation', 'trpc.rentalBundle.syncExternalBundles.useMutation');
pageContent = pageContent.replace('Sync dari Santi Living', 'Sync External Bundles');
pageContent = pageContent.replace('master data Santi Living', 'external master data');

fs.writeFileSync('apps/web/src/features/rental/pages/RentalBundlesPage.tsx', pageContent);

