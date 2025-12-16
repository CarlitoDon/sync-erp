/**
 * Inventory Service Integration Tests
 *
 * Tests that InventoryService correctly enforces Policy checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { InventoryService } from '../../../../src/modules/inventory/inventory.service';

// Mock the dependent services and repository
vi.mock('../../../../src/modules/inventory/inventory.repository');
vi.mock('../../../../src/modules/procurement/procurement.service');

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
    vi.clearAllMocks();
  });

  describe('processGoodsReceipt with Policy check', () => {
    const mockData = {
      orderId: 'order-123',
      items: [{ productId: 'prod-1', quantity: 10 }],
    };

    it('throws DomainError for SERVICE company shape', async () => {
      await expect(
        service.processGoodsReceipt('company-1', mockData, BusinessShape.SERVICE)
      ).rejects.toThrowError(DomainError);
    });

    it('throws DomainError for PENDING company shape', async () => {
      await expect(
        service.processGoodsReceipt('company-1', mockData, BusinessShape.PENDING)
      ).rejects.toThrowError(DomainError);
    });

    // Note: Full success tests require mocking repository and procurement service
    // which is complex. Policy check is the critical path tested here.
  });

  describe('adjustStock with Policy check', () => {
    const mockData = {
      productId: 'prod-1',
      quantity: 5,
      costPerUnit: 100,
      reference: 'Manual adjustment',
    };

    it('throws DomainError for SERVICE company shape', async () => {
      await expect(
        service.adjustStock('company-1', mockData, BusinessShape.SERVICE)
      ).rejects.toThrowError(DomainError);
    });

    it('throws DomainError for PENDING company shape', async () => {
      await expect(
        service.adjustStock('company-1', mockData, BusinessShape.PENDING)
      ).rejects.toThrowError(DomainError);
    });

    // Note: Full success tests require mocking repository
  });
});
