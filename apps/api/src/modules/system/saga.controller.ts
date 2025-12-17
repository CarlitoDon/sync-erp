import { Request, Response } from 'express';
import { findSagaLogById } from '../common/saga/saga-log.repository';
import { DomainErrorCodes } from '@sync-erp/shared';

export class SagaController {
  /**
   * Manual recovery endpoint for Sagas
   * POST /system/sagas/:id/recover
   * FR-034
   */
  async manualRecover(req: Request, res: Response) {
    const { id } = req.params;

    // 1. Verify Saga exists
    const saga = await findSagaLogById(id);
    if (!saga) {
      // Use standard error response if middleware handles it, or manual JSON
      return res.status(404).json({
        success: false,
        error: 'Saga log not found',
        code: DomainErrorCodes.NOT_FOUND,
      });
    }

    // 2. Log access (Auditing)
    console.warn(
      `[SagaController] Manual intervention requested for Saga ${id} [${saga.sagaType}]`
    );

    // 3. Return status
    return res.status(200).json({
      success: true,
      message: 'Saga recovery signal received',
      data: {
        id: saga.id,
        type: saga.sagaType,
        status: saga.step,
        error: saga.error,
        recommendation: 'Check logs and retry operation if resolved',
      },
    });
  }
}
