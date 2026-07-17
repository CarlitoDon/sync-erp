import { describe, expect, it } from 'vitest';
import { SelectShapeSchema } from '../../src/validators/company';

describe('company validators', () => {
  it('allows rental as a selectable company shape', () => {
    expect(SelectShapeSchema.parse({ shape: 'RENTAL' })).toEqual({
      shape: 'RENTAL',
    });
  });

  it('rejects pending as a selectable company shape', () => {
    expect(() =>
      SelectShapeSchema.parse({ shape: 'PENDING' })
    ).toThrow('Shape must be one of');
  });
});
