export class CashBankPolicy {
  // Placeholder for Policy Logic
  static ensureNotArchived(account: { isArchived: boolean }) {
    if (account.isArchived) {
      throw new Error('Account is archived');
    }
  }
}
