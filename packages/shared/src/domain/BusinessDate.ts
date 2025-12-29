import {
  DomainError,
  DomainErrorCodes,
} from '../errors/domain-error';

export class BusinessDate {
  private readonly _date: Date;
  // Standard timezone? For now assuming UTC or Server Local as per legacy.
  // Ideally store YYYY-MM-DD string as internal, but converting to Date for operations.

  constructor(date: Date | string) {
    this._date = new Date(date);
    if (isNaN(this._date.getTime())) {
      throw new Error('Invalid date');
    }
  }

  static from(date: Date | string): BusinessDate {
    return new BusinessDate(date);
  }

  static now(): BusinessDate {
    return new BusinessDate(new Date());
  }

  get date(): Date {
    return new Date(this._date);
  }

  /**
   * Check if date is in future relative to NOW + tolerance (24h to handle timezones)
   */
  isFuture(toleranceMs = 24 * 60 * 60 * 1000): boolean {
    const now = new Date();
    return this._date.getTime() > now.getTime() + toleranceMs;
  }

  /**
   * Ensure date is valid (not excessively in the future). Throws if invalid.
   */
  ensureValid(): void {
    if (this.isFuture()) {
      throw new Error('Business date cannot be in the future');
    }
  }

  ensureNotBackdated(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (this._date < today) {
      throw new DomainError(
        'Backdated transactions are disabled in Phase 1',
        400,
        DomainErrorCodes.FEATURE_DISABLED_PHASE_1
      );
    }
  }

  toISODate(): string {
    return this._date.toISOString().split('T')[0];
  }

  toString(): string {
    return this.toISODate();
  }
}
