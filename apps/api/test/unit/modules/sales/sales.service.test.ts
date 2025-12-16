/**
 * Sales Service Integration Tests
 *
 * Tests that SalesService correctly enforces Policy checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { SalesService } from '../../../../src/modules/sales/sales.service';

// Mock dependencies
vi.mock('../../../../src/modules/sales/sales.repository');
vi.mock('../../../../src/modules/product/product.service');
vi.mock('../../../../src/modules/inventory/inventory.service');
vi.mock('../../../../src/modules/common/services/document-number.service');

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(() => {
    service = new SalesService();
    vi.clearAllMocks();
  });

  describe('create with Policy check', () => {
    const mockData = {
      partnerId: 'partner-123',
      items: [{ productId: 'prod-1', quantity: 1, price: 100 }],
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

    // RETAIL and MANUFACTURING should allow physical goods sales
    // Full success tests require mocking repository
  });
});
