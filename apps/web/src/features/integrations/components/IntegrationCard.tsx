import { Link } from 'react-router-dom';
import {
  CubeIcon,
  SpeakerWaveIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  PlusIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui';

interface IntegrationCardProps {
  app: {
    appId: string;
    name: string;
    description: string;
    icon: string;
    isInstalled: boolean;
    installation: any;
  };
  onInstall: (appId: string) => void;
  isInstalling: boolean;
}

const ICONS: Record<string, any> = {
  CubeIcon,
  SpeakerWaveIcon,
  ComputerDesktopIcon,
  CodeBracketIcon,
};

export function IntegrationCard({
  app,
  onInstall,
  isInstalling,
}: IntegrationCardProps) {
  const Icon = ICONS[app.icon] || CubeIcon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`p-3 rounded-lg ${app.isInstalled ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}
        >
          <Icon className="w-8 h-8" />
        </div>
        {app.isInstalled && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            Active
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {app.name}
      </h3>
      <p className="text-sm text-gray-500 mb-6 flex-1">
        {app.description}
      </p>

      <div className="mt-auto">
        {app.isInstalled ? (
          <Link to={`/integrations/${app.installation.id}`}>
            <Button variant="outline" className="w-full">
              Configure
            </Button>
          </Link>
        ) : (
          <Button
            className="w-full"
            onClick={() => onInstall(app.appId)}
            disabled={isInstalling}
          >
            {isInstalling ? (
              'Installing...'
            ) : (
              <>
                <PlusIcon className="w-4 h-4 mr-2" />
                Connect
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
