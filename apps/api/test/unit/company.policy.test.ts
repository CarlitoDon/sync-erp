import { describe, expect, it } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { CompanyPolicy } from '../../src/modules/company/company.policy';

describe('company policy', () => {
  it('allows rental as an initial business shape', () => {
    expect(CompanyPolicy.isValidTargetShape(BusinessShape.RENTAL)).toBe(
      true
    );
    expect(() =>
      CompanyPolicy.ensureValidTargetShape(BusinessShape.RENTAL)
    ).not.toThrow();
  });

  it('still rejects pending as a selected business shape', () => {
    expect(CompanyPolicy.isValidTargetShape(BusinessShape.PENDING)).toBe(
      false
    );
    expect(() =>
      CompanyPolicy.ensureValidTargetShape(BusinessShape.PENDING)
    ).toThrow('Invalid target shape');
  });
});
