import { AttachmentEntityType } from '@sync-erp/database';
import { z } from 'zod';
import { AttachmentService } from '../../modules/attachment/attachment.service';
import { protectedProcedure, router } from '../trpc';

const attachmentService = new AttachmentService();

const EntityReferenceSchema = z.object({
  entityType: z.nativeEnum(AttachmentEntityType),
  entityId: z.string().uuid(),
});

export const attachmentRouter = router({
  list: protectedProcedure
    .input(EntityReferenceSchema)
    .query(async ({ ctx, input }) => {
      return attachmentService.list(
        ctx.companyId,
        input.entityType,
        input.entityId
      );
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return attachmentService.get(ctx.companyId, input.id);
    }),

  upload: protectedProcedure
    .input(
      EntityReferenceSchema.extend({
        fileName: z.string().min(1),
        mimeType: z.string().min(1).optional(),
        fileBase64: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return attachmentService.upload(ctx.companyId, ctx.userId, input);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return attachmentService.delete(ctx.companyId, input.id);
    }),
});

export type AttachmentRouter = typeof attachmentRouter;
