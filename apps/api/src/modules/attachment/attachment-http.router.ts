import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth';
import { AttachmentService } from './attachment.service';

export const attachmentHttpRouter = Router();
const attachmentService = new AttachmentService();

attachmentHttpRouter.get(
  '/:id/download',
  authMiddleware,
  async (req, res, next) => {
    try {
      const companyId = req.context.companyId;
      if (!companyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Company context is required',
          },
        });
        return;
      }

      const { attachment, absolutePath } =
        await attachmentService.getDownload(companyId, req.params.id);

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Length', String(attachment.sizeBytes));
      res.download(absolutePath, attachment.originalFileName);
    } catch (error) {
      next(error);
    }
  }
);
