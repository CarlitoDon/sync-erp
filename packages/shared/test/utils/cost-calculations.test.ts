import { describe, it, expect } from 'vitest';
import { calculateNewAvgCost, calculateHPP_AVG } from '../../src/utils/cost-calculations';

describe('Cost Calculations', () => {
  describe('calculateNewAvgCost', () => {
    it('calculates weighted average cost correctly when adding new inventory', () => {
      // 10 units @ 100, add 10 units @ 200 => (1000 + 2000) / 20 = 150
      const result = calculateNewAvgCost(10, 100, 10, 200);
      expect(result).toBe(150);
    });

    it('returns 0 when total quantity is 0', () => {
      const result = calculateNewAvgCost(0, 0, 0, 0);
      expect(result).toBe(0);
    });

    it('handles initial zero stock (first receipt)', () => {
      // 0 units @ 0, add 5 units @ 50 => (0 + 250) / 5 = 50
      const result = calculateNewAvgCost(0, 0, 5, 50);
      expect(result).toBe(50);
    });

    it('handles decimal quantities and costs accurately', () => {
      // 10.5 units @ 12.5, add 4.5 units @ 15.0 => (131.25 + 67.5) / 15 = 198.75 / 15 = 13.25
      const result = calculateNewAvgCost(10.5, 12.5, 4.5, 15.0);
      expect(result).toBeCloseTo(13.25, 5);
    });
  });

  describe('calculateHPP_AVG', () => {
    it('calculates cost of goods sold based on quantity and average cost', () => {
      const result = calculateHPP_AVG(5, 120);
      expect(result).toBe(600);
    });

    it('returns 0 when quantity is 0', () => {
      const result = calculateHPP_AVG(0, 120);
      expect(result).toBe(0);
    });
  });
});
