import type { Request, Response } from 'express';
import { logoutAndRestart } from '../bot/baileys';

export const logout = async (_req: Request, res: Response) => {
  try {
    await logoutAndRestart();
    res.json({ success: true, message: 'Logged out and session cleared' });
  } catch (error) {
    console.error('[Logout] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed',
    });
  }
};
