import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import BankAccountList from './components/BankAccountList';
import CashTransactionList from './components/CashTransactionList';
import SpendMoneyModal from './components/SpendMoneyModal';
import ReceiveMoneyModal from './components/ReceiveMoneyModal';
import TransferMoneyModal from './components/TransferMoneyModal';

export default function CashBankPage() {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<
    'accounts' | 'transactions'
  >('accounts');
  const [isSpendModalOpen, setIsSpendModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] =
    useState(false);

  if (!currentCompany) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Cash & Bank
          </h1>
          <p className="text-gray-500">
            Manage your bank accounts, cash on hand, and view
            transaction history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsSpendModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
          >
            <ArrowUpIcon className="w-4 h-4" />
            Spend Money
          </Button>
          <Button
            onClick={() => setIsReceiveModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
          >
            <ArrowDownIcon className="w-4 h-4" />
            Receive Money
          </Button>
          <Button
            onClick={() => setIsTransferModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
          >
            <ArrowsRightLeftIcon className="w-4 h-4" />
            Transfer
          </Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('accounts')}
        >
          Accounts
        </button>
        <button
          className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'accounts' ? (
          <BankAccountList />
        ) : (
          <CashTransactionList />
        )}
      </div>

      <SpendMoneyModal
        isOpen={isSpendModalOpen}
        onClose={() => setIsSpendModalOpen(false)}
      />

      <ReceiveMoneyModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
      />

      <TransferMoneyModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
  );
}
