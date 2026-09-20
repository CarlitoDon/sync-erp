import {
  IntegrationComponentItem,
  IntegrationOrderAdapter,
  IntegrationOrderContext,
  IntegrationOrderInput,
  IntegrationOrderInputSchema,
  IntegrationOrderItemInput,
  OrderServicePort,
} from '../types.js';
import { parseComponentLabel } from './mappers/component.mapper.js';
import { SANTI_LIVING_DEFAULTS } from './config/defaults.js';

function isStringArray(arr: unknown[]): arr is string[] {
  return arr.every((el) => typeof el === 'string');
}

export const santiLivingOrderAdapter: IntegrationOrderAdapter = {
  skuPrefix: SANTI_LIVING_DEFAULTS.skuPrefix,
  createdBy: SANTI_LIVING_DEFAULTS.createdBy,
  parseComponents(raw: string[]): IntegrationComponentItem[] {
    return raw.map((component) => parseComponentLabel(component));
  },
  async createOrder(
    orderService: OrderServicePort,
    input: IntegrationOrderInput,
    context?: IntegrationOrderContext
  ): Promise<unknown> {
    // Validate boundary input
    const validatedInput = IntegrationOrderInputSchema.parse(input);

    // Map component strings to object structure expected by generic service
    const items = validatedInput.items.map((item: IntegrationOrderItemInput) => {
      if (
        item.components &&
        Array.isArray(item.components) &&
        item.components.length > 0 &&
        isStringArray(item.components)
      ) {
        return {
          ...item,
          components: item.components.map((c: string) => parseComponentLabel(c)),
        };
      }
      return item;
    });

    return orderService.createOrder(
      {
        ...validatedInput,
        items,
        createdBy: SANTI_LIVING_DEFAULTS.createdBy,
        skuPrefix: SANTI_LIVING_DEFAULTS.skuPrefix,
      },
      context
    );
  },
};
