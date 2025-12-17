import { Decimal } from 'decimal.js';

export class Money {
  private readonly _amount: Decimal;
  private readonly _currency: string;

  private constructor(
    amount: Decimal | number | string,
    currency = 'USD'
  ) {
    this._amount = new Decimal(amount);
    this._currency = currency;
  }

  static from(
    amount: number | string | Decimal,
    currency = 'USD'
  ): Money {
    return new Money(amount, currency);
  }

  static zero(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  get amount(): number {
    return this._amount.toNumber();
  }

  get currency(): string {
    return this._currency;
  }

  toDecimal(): Decimal {
    // Return a clone to maintain immutability? Decimal is immutable?
    // Decimal methods return new instances, but it's an object.
    // Cloning is validation.
    return new Decimal(this._amount);
  }

  equals(other: Money): boolean {
    return (
      this._amount.equals(other._amount) &&
      this._currency === other._currency
    );
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(
      this._amount.plus(other._amount),
      this._currency
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(
      this._amount.minus(other._amount),
      this._currency
    );
  }

  multiply(multiplier: number | Decimal): Money {
    return new Money(this._amount.times(multiplier), this._currency);
  }

  allocate(ratios: number[]): Money[] {
    const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
    // const totalAmount = this._amount.toNumber(); // unused
    // let remainder = totalAmount; // removed unused
    // Better: use Decimal for allocation to avoid float issues.
    // 100 split 3 ways: 33.33, 33.33, 33.34 (remainder handling).

    // Scale to cents (2 decimal places) for distribution?
    // Or just work with Decimal.

    // Implementation:
    // 1. Calculate parts
    // 2. Sum parts
    // 3. Add difference to first/last bucket?

    const results: Decimal[] = [];
    let allocatedTotal = new Decimal(0);

    for (const ratio of ratios) {
      const share = this._amount
        .times(ratio)
        .div(totalRatio)
        .toDecimalPlaces(2, Decimal.ROUND_DOWN);
      results.push(share);
      allocatedTotal = allocatedTotal.plus(share);
    }

    const diff = this._amount.minus(allocatedTotal);
    if (!diff.isZero()) {
      // Add remainder to first chunk?
      // Or distribute 0.01 to each until gone?
      // Simple: Add to first.
      results[0] = results[0].plus(diff);
    }

    return results.map((d) => new Money(d, this._currency));
  }

  toString(): string {
    return this._amount.toFixed(2);
  }

  toJSON(): { amount: number; currency: string } {
    return {
      amount: this._amount.toNumber(),
      currency: this._currency,
    };
  }

  private assertSameCurrency(other: Money) {
    if (this._currency !== other._currency) {
      throw new Error(
        `Currency mismatch: cannot operate ${this._currency} with ${other._currency}`
      );
    }
  }
}
