export class JournalInventoryService {
  prepareAdjustmentJournal(
    reference: string,
    amount: number,
    isLoss: boolean
  ) {
    const memo = isLoss ? 'Stock Loss/Shrinkage' : 'Stock Gain/Found';
    // If Loss: Dr Expense (5200), Cr Asset (1400)
    // If Gain: Dr Asset (1400), Cr Revenue/Contra (5200)

    const lines = isLoss
      ? [
          { accountCode: '5200', debit: amount },
          { accountCode: '1400', credit: amount },
        ]
      : [
          { accountCode: '1400', debit: amount },
          { accountCode: '5200', credit: amount },
        ];

    return {
      reference,
      memo,
      lines,
    };
  }
}
