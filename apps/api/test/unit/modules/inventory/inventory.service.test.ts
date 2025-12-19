/**
 * Inventory Service Integration Tests
 *
 * Tests that InventoryService correctly enforces Policy checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { InventoryService } from '@modules/inventory/inventory.service';

// Mock the dependent services and repository
vi.mock('@modules/inventory/inventory.repository');
vi.mock('@modules/procurement/purchase-order.service');

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
    vi.clearAllMocks();
  });

  describe('processGoodsReceipt with Policy check', () => {
    const mockData = {
      orderId: 'order-123',
      items: [{ id: 'item-1', productId: 'prod-1', quantity: 10 }],
    };

    it('throws DomainError for SERVICE company shape', async () => {
      await expect(
        service.processGoodsReceipt(
          'company-1',
          mockData,
          BusinessShape.SERVICE
        )
      ).rejects.toThrowError(DomainError);
    });

    it('throws DomainError for PENDING company shape', async () => {
      await expect(
        service.processGoodsReceipt(
          'company-1',
          mockData,
          BusinessShape.PENDING
        )
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
        service.adjustStock(
          'company-1',
          mockData,
          BusinessShape.SERVICE
        )
      ).rejects.toThrowError(DomainError);
    });

    it('throws DomainError for PENDING company shape', async () => {
      await expect(
        service.adjustStock(
          'company-1',
          mockData,
          BusinessShape.PENDING
        )
      ).rejects.toThrowError(DomainError);
    });

    // Note: Full success tests require mocking repository
  });

  describe('CA-01 & CA-02 Verification', () => {
    const mockData = {
      productId: 'prod-1',
      quantity: 5,
      costPerUnit: 100,
      reference: 'Manual adjustment',
    };

    it('CA-02: throws DomainError if config disabled', async () => {
      const configs = [{ key: 'inventory.enabled', value: false }];
      await expect(
        service.adjustStock(
          'company-1',
          mockData,
          BusinessShape.RETAIL,
          configs
        )
      ).rejects.toThrowError(DomainError);
    });

    it('CA-01: Policy Hard Stop - Repository MUST NOT be called if Policy rejects', async () => {
      // 1. Trigger Policy Rejection (SERVICE shape)
      try {
        await service.adjustStock(
          'company-1',
          mockData,
          BusinessShape.SERVICE
        );
      } catch (e) {
        // Expected error
      }

      const mockRepo = (service as any).repository;
      expect(mockRepo.createMovement).not.toHaveBeenCalled();
    });
  });
});
