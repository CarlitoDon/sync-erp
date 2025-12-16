/**
 * Company Policy Tests
 *
 * Tests for CompanyPolicy shape transition rules.
 */

import { describe, it, expect } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { CompanyPolicy } from '../../../../src/modules/company/company.policy';

describe('CompanyPolicy', () => {
  describe('canSelectShape', () => {
    it('returns true only for PENDING shape', () => {
      expect(CompanyPolicy.canSelectShape(BusinessShape.PENDING)).toBe(true);
      expect(CompanyPolicy.canSelectShape(BusinessShape.RETAIL)).toBe(false);
      expect(CompanyPolicy.canSelectShape(BusinessShape.MANUFACTURING)).toBe(false);
      expect(CompanyPolicy.canSelectShape(BusinessShape.SERVICE)).toBe(false);
    });
  });

  describe('ensureCanSelectShape', () => {
    it('throws DomainError for non-PENDING shapes', () => {
      expect(() => CompanyPolicy.ensureCanSelectShape(BusinessShape.RETAIL))
        .toThrowError(DomainError);
      expect(() => CompanyPolicy.ensureCanSelectShape(BusinessShape.MANUFACTURING))
        .toThrowError(DomainError);
      expect(() => CompanyPolicy.ensureCanSelectShape(BusinessShape.SERVICE))
        .toThrowError(DomainError);
    });

    it('does not throw for PENDING shape', () => {
      expect(() => CompanyPolicy.ensureCanSelectShape(BusinessShape.PENDING))
        .not.toThrow();
    });
  });

  describe('isValidTargetShape', () => {
    it('returns true for RETAIL, MANUFACTURING, SERVICE', () => {
      expect(CompanyPolicy.isValidTargetShape(BusinessShape.RETAIL)).toBe(true);
      expect(CompanyPolicy.isValidTargetShape(BusinessShape.MANUFACTURING)).toBe(true);
      expect(CompanyPolicy.isValidTargetShape(BusinessShape.SERVICE)).toBe(true);
    });

    it('returns false for PENDING', () => {
      expect(CompanyPolicy.isValidTargetShape(BusinessShape.PENDING)).toBe(false);
    });
  });

  describe('ensureValidTargetShape', () => {
    it('throws DomainError for PENDING target', () => {
      expect(() => CompanyPolicy.ensureValidTargetShape(BusinessShape.PENDING))
        .toThrowError(DomainError);
    });

    it('does not throw for valid target shapes', () => {
      expect(() => CompanyPolicy.ensureValidTargetShape(BusinessShape.RETAIL))
        .not.toThrow();
      expect(() => CompanyPolicy.ensureValidTargetShape(BusinessShape.MANUFACTURING))
        .not.toThrow();
      expect(() => CompanyPolicy.ensureValidTargetShape(BusinessShape.SERVICE))
        .not.toThrow();
    });
  });
});
