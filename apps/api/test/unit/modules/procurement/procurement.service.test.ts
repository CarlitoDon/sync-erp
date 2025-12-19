/**
 * Procurement Service Integration Tests
 *
 * Tests that PurchaseOrderService correctly enforces Policy checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';

// Mock dependencies
vi.mock('@modules/procurement/procurement.repository');
vi.mock('@modules/common/services/document-number.service');

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;

  beforeEach(() => {
    service = new PurchaseOrderService();
    vi.clearAllMocks();
  });

  describe('create with Policy check', () => {
    const mockData = {
      partnerId: 'partner-123',
      items: [{ productId: 'prod-1', quantity: 5, price: 50 }],
    };

    it('throws DomainError for SERVICE company shape', async () => {
      await expect(
        service.create('company-1', mockData, BusinessShape.SERVICE)
      ).rejects.toThrowError(DomainError);
    });

    it('throws DomainError for PENDING company shape', async () => {
      await expect(
        service.create('company-1', mockData, BusinessShape.PENDING)
      ).rejects.toThrowError(DomainError);
    });

    // RETAIL and MANUFACTURING should allow physical goods purchase
    // Full success tests require mocking repository
  });
});
