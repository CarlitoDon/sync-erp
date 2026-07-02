import { randomUUID, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  Attachment,
  AttachmentEntityType,
  FulfillmentType,
  InvoiceType,
  OrderType,
  prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

interface UploadAttachmentInput {
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  mimeType?: string;
  fileBase64: string;
  notes?: string;
}

interface AttachmentDownload {
  attachment: Attachment;
  absolutePath: string;
}

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

export class AttachmentService {
  async list(
    companyId: string,
    entityType: AttachmentEntityType,
    entityId: string
  ): Promise<Attachment[]> {
    await this.ensureEntityExists(companyId, entityType, entityId);

    return prisma.attachment.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(companyId: string, id: string): Promise<Attachment> {
    const attachment = await prisma.attachment.findFirst({
      where: { id, companyId },
    });

    if (!attachment) {
      throw new DomainError(
        'Attachment not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return attachment;
  }

  async upload(
    companyId: string,
    uploadedByUserId: string,
    input: UploadAttachmentInput
  ): Promise<Attachment> {
    await this.ensureEntityExists(
      companyId,
      input.entityType,
      input.entityId
    );

    const buffer = Buffer.from(
      stripDataUrlPrefix(input.fileBase64),
      'base64'
    );
    if (buffer.length === 0) {
      throw new DomainError(
        'Attachment file is empty',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const maxBytes = getMaxAttachmentBytes();
    if (buffer.length > maxBytes) {
      throw new DomainError(
        `Attachment exceeds max size of ${maxBytes} bytes`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const id = randomUUID();
    const originalFileName = sanitizeFileName(input.fileName);
    const checksumSha256 = createHash('sha256')
      .update(buffer)
      .digest('hex');
    const storageKey = buildStorageKey({
      companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      attachmentId: id,
      fileName: originalFileName,
    });
    const absolutePath = resolveStoragePath(storageKey);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer, { flag: 'wx' });

    try {
      return await prisma.attachment.create({
        data: {
          id,
          companyId,
          entityType: input.entityType,
          entityId: input.entityId,
          originalFileName,
          mimeType: input.mimeType || 'application/octet-stream',
          sizeBytes: buffer.length,
          checksumSha256,
          storageProvider: 'local',
          storageKey,
          uploadedByUserId,
          notes: input.notes,
        },
      });
    } catch (error) {
      await fs.unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  async delete(companyId: string, id: string): Promise<Attachment> {
    const attachment = await this.get(companyId, id);
    const absolutePath = resolveStoragePath(attachment.storageKey);

    await prisma.attachment.delete({ where: { id: attachment.id } });
    await fs.unlink(absolutePath).catch(() => undefined);

    return attachment;
  }

  async getDownload(
    companyId: string,
    id: string
  ): Promise<AttachmentDownload> {
    const attachment = await this.get(companyId, id);
    const absolutePath = resolveStoragePath(attachment.storageKey);
    await fs.access(absolutePath);

    return { attachment, absolutePath };
  }

  private async ensureEntityExists(
    companyId: string,
    entityType: AttachmentEntityType,
    entityId: string
  ): Promise<void> {
    const exists = await entityExists(companyId, entityType, entityId);
    if (!exists) {
      throw new DomainError(
        `${entityType} record not found for attachment`,
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }
  }
}

async function entityExists(
  companyId: string,
  entityType: AttachmentEntityType,
  entityId: string
): Promise<boolean> {
  switch (entityType) {
    case AttachmentEntityType.BILL:
      return Boolean(
        await prisma.invoice.findFirst({
          where: { id: entityId, companyId, type: InvoiceType.BILL },
          select: { id: true },
        })
      );
    case AttachmentEntityType.INVOICE:
      return Boolean(
        await prisma.invoice.findFirst({
          where: { id: entityId, companyId, type: InvoiceType.INVOICE },
          select: { id: true },
        })
      );
    case AttachmentEntityType.EXPENSE:
      return Boolean(
        await prisma.invoice.findFirst({
          where: { id: entityId, companyId, type: InvoiceType.EXPENSE },
          select: { id: true },
        })
      );
    case AttachmentEntityType.PURCHASE_ORDER:
      return Boolean(
        await prisma.order.findFirst({
          where: { id: entityId, companyId, type: OrderType.PURCHASE },
          select: { id: true },
        })
      );
    case AttachmentEntityType.SALES_ORDER:
      return Boolean(
        await prisma.order.findFirst({
          where: { id: entityId, companyId, type: OrderType.SALES },
          select: { id: true },
        })
      );
    case AttachmentEntityType.GOODS_RECEIPT:
      return Boolean(
        await prisma.fulfillment.findFirst({
          where: {
            id: entityId,
            companyId,
            type: FulfillmentType.RECEIPT,
          },
          select: { id: true },
        })
      );
    case AttachmentEntityType.SHIPMENT:
      return Boolean(
        await prisma.fulfillment.findFirst({
          where: {
            id: entityId,
            companyId,
            type: FulfillmentType.SHIPMENT,
          },
          select: { id: true },
        })
      );
    case AttachmentEntityType.PAYMENT:
      return Boolean(
        await prisma.payment.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        })
      );
    case AttachmentEntityType.RENTAL_ORDER:
      return Boolean(
        await prisma.rentalOrder.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        })
      );
    case AttachmentEntityType.RENTAL_ITEM:
      return Boolean(
        await prisma.rentalItem.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        })
      );
    case AttachmentEntityType.PRODUCT:
      return Boolean(
        await prisma.product.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        })
      );
    case AttachmentEntityType.PARTNER:
      return Boolean(
        await prisma.partner.findFirst({
          where: { id: entityId, companyId },
          select: { id: true },
        })
      );
  }
}

function getStorageRoot(): string {
  if (process.env.SYNC_ERP_STORAGE_DIR) {
    return path.resolve(process.env.SYNC_ERP_STORAGE_DIR);
  }

  return path.resolve(getProjectRoot(), 'storage');
}

function resolveStoragePath(storageKey: string): string {
  const root = getStorageRoot();
  const absolutePath = path.resolve(root, storageKey);
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!absolutePath.startsWith(normalizedRoot)) {
    throw new DomainError(
      'Invalid attachment storage path',
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  return absolutePath;
}

function buildStorageKey(input: {
  companyId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  attachmentId: string;
  fileName: string;
}): string {
  const extension = path.extname(input.fileName).slice(0, 16);
  return path.posix.join(
    'attachments',
    input.companyId,
    input.entityType,
    input.entityId,
    `${input.attachmentId}${extension}`
  );
}

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName).replace(/[^\w.\- ]+/g, '_');
  return baseName.trim() || 'attachment';
}

function stripDataUrlPrefix(value: string): string {
  const marker = ';base64,';
  const markerIndex = value.indexOf(marker);
  return markerIndex === -1
    ? value
    : value.slice(markerIndex + marker.length);
}

function getMaxAttachmentBytes(): number {
  const configured = Number(process.env.SYNC_ERP_ATTACHMENT_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_BYTES;
}

function getProjectRoot(): string {
  const cwd = process.cwd();
  if (
    path.basename(cwd) === 'api' &&
    path.basename(path.dirname(cwd)) === 'apps'
  ) {
    return path.dirname(path.dirname(cwd));
  }

  return cwd;
}
