import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import {
  CheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteUserModal({
  isOpen,
  onClose,
}: InviteUserModalProps) {
  const { currentCompany } = useCompany();
  const [copied, setCopied] = useState<'code' | 'link' | null>(
    null
  );

  const inviteCode = currentCompany?.inviteCode ?? '';
  const inviteLink = inviteCode
    ? `${window.location.origin}/select-company?inviteCode=${encodeURIComponent(inviteCode)}`
    : '';

  const copyToClipboard = async (
    value: string,
    target: 'code' | 'link'
  ) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

<<<<<<< HEAD
    setCopied(target);
    toast.success('Invite copied');
    window.setTimeout(() => setCopied(null), 1600);
=======
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !validate()) return;

    createMutation.mutate({
      email,
      name,
      passwordHash: 'changeme',
    });
>>>>>>> origin/dev
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <p className="text-sm text-gray-600">
            Share this code or link. The person should create or sign in
            to their own account, then join this company.
          </p>

          {inviteCode ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invite Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-code"
                    value={inviteCode}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Copy invite code"
                    onClick={() =>
                      copyToClipboard(inviteCode, 'code')
                    }
                    className="shrink-0"
                  >
                    {copied === 'code' ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-link">Invite Link</Label>
                <div className="flex gap-2">
                  <Input id="invite-link" value={inviteLink} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Copy invite link"
                    onClick={() =>
                      copyToClipboard(inviteLink, 'link')
                    }
                    className="shrink-0"
                  >
                    {copied === 'link' ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This company does not have an invite code yet.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
