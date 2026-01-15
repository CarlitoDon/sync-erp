import { trpc } from '@/lib/trpc';
import { PageHeader } from '@/components/layout/PageHeader';
import { IntegrationCard } from '../components/IntegrationCard';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CreateCustomIntegrationModal } from '../components/CreateCustomIntegrationModal';

export default function IntegrationsListPage() {
  const utils = trpc.useUtils();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: integrations, isLoading } =
    trpc.integration.list.useQuery();

  const installMutation = trpc.integration.install.useMutation({
    onSuccess: (data) => {
      toast.success(`Connected to ${data.integration.name}`);
      utils.integration.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to install: ${err.message}`);
    },
  });

  const createCustomMutation =
    trpc.integration.createCustom.useMutation({
      onSuccess: (data) => {
        toast.success(
          `Custom Integration created: ${data.integration.name}`
        );
        setIsCreateModalOpen(false);
        utils.integration.list.invalidate();
      },
      onError: (err) => {
        toast.error(`Failed to create: ${err.message}`);
      },
    });

  const handleInstall = (appId: string) => {
    installMutation.mutate({ appId });
  };

  const handleCreateCustom = (data: {
    name: string;
    description?: string;
  }) => {
    createCustomMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading Integrations...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Integrations Marketplace"
          description="Connect Sync ERP with your favorite operational tools and services."
        />
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Custom App
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations?.map((app) => (
          <IntegrationCard
            key={app.appId}
            app={app}
            onInstall={handleInstall}
            isInstalling={installMutation.isPending}
          />
        ))}
      </div>

      <CreateCustomIntegrationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateCustom}
        isSubmitting={createCustomMutation.isPending}
      />
    </div>
  );
}
