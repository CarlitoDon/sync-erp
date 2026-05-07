const fs = require('fs');
let content = fs.readFileSync('apps/api/src/modules/rental/rental-external-order.service.ts', 'utf8');

// Update CreatePublicOrderInput
content = content.replace('export interface CreatePublicOrderInput {', `export interface CreatePublicOrderInput {
  integrationId?: string;
  createdBy?: string;
  skuPrefix?: string;`);
content = content.replace(/components\?\:\s*string\[\];/g, 'components?: { quantity: number; label: string }[];');

// Update UpdatePublicOrderInput
content = content.replace('export interface UpdatePublicOrderInput {', `export interface UpdatePublicOrderInput {
  integrationId?: string;`);

// In createOrder
content = content.replace('createdBy: \'santi-living-website\',', 'integrationId: input.integrationId,\n        createdBy: input.createdBy || \'API\',');

// update buildOrderItems call in createOrder
content = content.replace(/allowAutoCreate\:\s*true\,/, `allowAutoCreate: true,
      integrationId: input.integrationId,
      skuPrefix: input.skuPrefix,`);

// In updateOrder, update buildOrderItems call
content = content.replace(/allowAutoCreate\:\s*true\,\s*\}\)\;/g, `allowAutoCreate: true,
        integrationId: input.integrationId,
      });`);

// Update buildOrderItems signature
content = content.replace('allowAutoCreate: boolean;', 'allowAutoCreate: boolean;\n    integrationId?: string;\n    skuPrefix?: string;');

// Update buildOrderItems body
content = content.replace('params.allowAutoCreate', 'params.allowAutoCreate,\n          params.integrationId,\n          params.skuPrefix');
content = content.replace('params.allowAutoCreate', 'params.allowAutoCreate,\n          params.skuPrefix');

// Update resolveBundle signature
content = content.replace('allowAutoCreate: boolean', 'allowAutoCreate: boolean,\n    integrationId?: string,\n    skuPrefix?: string');
content = content.replace('createBundleWithComponents(companyId, item)', 'createBundleWithComponents(companyId, item, integrationId, skuPrefix)');

// Update createBundleWithComponents
content = content.replace('item: ExternalOrderItemInput', 'item: ExternalOrderItemInput,\n    integrationId?: string,\n    skuPrefix?: string');
content = content.replace('companyId,', 'companyId,\n          integrationId,');
content = content.replace('const { quantity, label } = this.parseComponentLabel(component);', 'const { quantity, label } = component;');
content = content.replace('tx,\n          companyId,\n          label', 'tx,\n          companyId,\n          label,\n          skuPrefix');

// Update resolveRentalItem
content = content.replace('allowAutoCreate: boolean', 'allowAutoCreate: boolean,\n    skuPrefix?: string');
content = content.replace('this.toExternalSku(item.components[0])', 'this.toExternalSku(item.components[0].label, skuPrefix)');
content = content.replace('findOrCreateRentalItem(companyId, item)', 'findOrCreateRentalItem(companyId, item, skuPrefix)');

// Update findOrCreateRentalItem
content = content.replace('item: ExternalOrderItemInput', 'item: ExternalOrderItemInput,\n    skuPrefix?: string');
content = content.replace('componentName\n      ? this.capitalizeLabel(componentName)\n      : item.name;', 'componentName ? this.capitalizeLabel(componentName.label) : item.name;');
content = content.replace('componentName\n      ? this.toExternalSku(componentName)\n      : this.toExternalSku(item.rentalItemId);', 'componentName ? this.toExternalSku(componentName.label, skuPrefix) : this.toExternalSku(item.rentalItemId, skuPrefix);');

// Update findOrCreateComponentRentalItem
content = content.replace('label: string', 'label: string,\n    skuPrefix?: string');
content = content.replace('this.toExternalSku(label)', 'this.toExternalSku(label, skuPrefix)');

// Remove parseComponentLabel
content = content.replace(/private parseComponentLabel[\s\S]*?\}\s*private toExternalSku/m, 'private toExternalSku');

// Update toExternalSku
content = content.replace('value: string', 'value: string, skuPrefix?: string');
content = content.replace('return `SL-${value.toLowerCase().replace(/\\s+/g, \'-\')}`;', 'const formatted = value.toLowerCase().replace(/\\s+/g, \'-\');\n    return skuPrefix ? `${skuPrefix}${formatted}` : formatted;');

fs.writeFileSync('apps/api/src/modules/rental/rental-external-order.service.ts', content);
