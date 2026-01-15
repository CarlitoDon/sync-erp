import type { Request, Response } from 'express';
import {
  getStatus as getBotStatus,
  getQrDataUrl,
} from '../bot/baileys';

export const getStatus = (_req: Request, res: Response) => {
  res.json({
    status: getBotStatus(),
    qrCode: getQrDataUrl(),
  });
};
