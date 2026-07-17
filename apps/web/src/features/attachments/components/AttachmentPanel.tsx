/* eslint-disable @sync-erp/no-hardcoded-enum */
import { useRef, useState, type ChangeEvent } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import type { RouterOutputs } from '@/types/api';
import {
  ActionButton,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';

type AttachmentEntityType =
  | 'BILL'
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'SALES_ORDER'
  | 'GOODS_RECEIPT'
  | 'SHIPMENT'
  | 'PAYMENT'
  | 'EXPENSE'
  | 'RENTAL_ORDER'
  | 'RENTAL_ITEM'
  | 'PRODUCT'
  | 'PARTNER';

type AttachmentRecord =
  RouterOutputs['attachment']['list'][number];

interface AttachmentPanelProps {
  entityType: AttachmentEntityType;
  entityId: string;
  title?: string;
}

export function AttachmentPanel({
  entityType,
  entityId,
  title = 'Attachments',
}: AttachmentPanelProps) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null
  );
  const [isReadingFile, setIsReadingFile] = useState(false);

  const attachmentsQuery = trpc.attachment.list.useQuery(
    { entityType, entityId },
    { enabled: !!currentCompany?.id && !!entityId }
  );

  const uploadMutation = trpc.attachment.upload.useMutation({
    onSuccess: () => {
      setErrorMessage(null);
      utils.attachment.list.invalidate({ entityType, entityId });
    },
    onError: (error) => {
      setErrorMessage(error.message);
    },
  });

  const deleteMutation = trpc.attachment.delete.useMutation({
    onSuccess: () => {
      utils.attachment.list.invalidate({ entityType, entityId });
    },
    onError: (error) => {
      setErrorMessage(error.message);
    },
  });

  const attachments = attachmentsQuery.data || [];
  const isUploading = isReadingFile || uploadMutation.isPending;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setIsReadingFile(true);
      setErrorMessage(null);
      const fileBase64 = await readFileAsBase64(file);
      await uploadMutation.mutateAsync({
        entityType,
        entityId,
        fileName: file.name,
        mimeType: file.type || undefined,
        fileBase64,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Upload failed'
      );
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleDownload = async (attachment: AttachmentRecord) => {
    if (!currentCompany?.id) return;

    try {
      setErrorMessage(null);
      const response = await fetch(
        `${getApiBaseUrl()}/attachments/${attachment.id}/download`,
        {
          credentials: 'include',
          headers: { 'x-company-id': currentCompany.id },
        }
      );

      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.originalFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Download failed'
      );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <ActionButton
            variant="outline"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            Upload
          </ActionButton>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelected}
        />

        {errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        {attachmentsQuery.isLoading && (
          <p className="text-sm text-gray-500">Loading...</p>
        )}

        {!attachmentsQuery.isLoading && attachments.length === 0 && (
          <p className="text-sm text-gray-500">No files attached.</p>
        )}

        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {attachment.originalFileName}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(attachment.sizeBytes)} -{' '}
                {new Date(attachment.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ActionButton
                variant="secondary"
                onClick={() => handleDownload(attachment)}
              >
                Download
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={async () => {
                  await deleteMutation.mutateAsync({
                    id: attachment.id,
                  });
                }}
                disabled={deleteMutation.isPending}
              >
                Delete
              </ActionButton>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to read file'));
        return;
      }

      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Unable to read file'));
        return;
      }

      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

function getApiBaseUrl(): string {
  const configuredUrl =
    import.meta.env.VITE_SYNC_ERP_API_URL ||
    'http://localhost:3001/api/trpc';

  return configuredUrl.replace(/\/trpc\/?$/, '');
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}
