/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationOrderAdapter } from '../types.js';
import { parseComponentLabel } from './mappers/component.mapper.js';
import { SANTI_LIVING_DEFAULTS } from './config/defaults.js';

export const santiLivingOrderAdapter: IntegrationOrderAdapter = {
  skuPrefix: SANTI_LIVING_DEFAULTS.skuPrefix,
  createdBy: SANTI_LIVING_DEFAULTS.createdBy,
  parseComponents(raw: string[]) {
    return raw.map((component) => parseComponentLabel(component));
  },
  async createOrder(orderService: any, input: any, context: any) {
    // This hook allows modifying the input before it hits the generic PublicOrderService
    // In our case we need to map components strings to object structure expected by generic service

    const items = input.items.map((item: any) => {
      if (
        item.components &&
        Array.isArray(item.components) &&
        typeof item.components[0] === 'string'
      ) {
        return {
          ...item,
          components: item.components.map((c: string) =>
            parseComponentLabel(c)
          ),
        };
      }
      return item;
    });

    return orderService.createOrder(
      {
        ...input,
        items,
        createdBy: SANTI_LIVING_DEFAULTS.createdBy,
        skuPrefix: SANTI_LIVING_DEFAULTS.skuPrefix,
      },
      context
    );
  },
};
