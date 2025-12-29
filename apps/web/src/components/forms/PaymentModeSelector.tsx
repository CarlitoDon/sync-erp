import { useState, useEffect } from 'react';
import { PaymentTermsSchema } from '@sync-erp/shared';
import { formatCurrency } from '@/utils/format';
import Select from '@/components/ui/Select';
import { QuantityInput, CurrencyInput } from '@/components/ui';

// UI-level payment mode constants (not database enums)
const PAYMENT_MODES = {
  TEMPO: 'TEMPO',
  UPFRONT: 'UPFRONT',
  COD: 'COD',
} as const;

type PaymentMode = (typeof PAYMENT_MODES)[keyof typeof PAYMENT_MODES];

interface PaymentConfig {
  mode: PaymentMode;
  paymentTerms: string;
  withDP: boolean;
  dpPercent: number;
  dpAmount: number;
}

interface PaymentModeSelectorProps {
  totalAmount: number;
  value: PaymentConfig;
  onChange: (config: PaymentConfig) => void;
}

const TEMPO_OPTIONS = [
  { value: PaymentTermsSchema.enum.NET7, label: 'Net 7 Hari' },
  { value: PaymentTermsSchema.enum.NET30, label: 'Net 30 Hari' },
  { value: PaymentTermsSchema.enum.NET60, label: 'Net 60 Hari' },
  { value: PaymentTermsSchema.enum.NET90, label: 'Net 90 Hari' },
  { value: PaymentTermsSchema.enum.EOM, label: 'End of Month' },
];

export default function PaymentModeSelector({
  totalAmount,
  value,
  onChange,
}: PaymentModeSelectorProps) {
  const [localDpPercent, setLocalDpPercent] = useState(
    value.dpPercent
  );
  const [localDpAmount, setLocalDpAmount] = useState(value.dpAmount);

  // Sync dpAmount when totalAmount or dpPercent changes
  useEffect(() => {
    if (
      value.mode === PAYMENT_MODES.TEMPO &&
      value.withDP &&
      localDpPercent > 0
    ) {
      const calculated = (totalAmount * localDpPercent) / 100;
      setLocalDpAmount(calculated);
      onChange({
        ...value,
        dpPercent: localDpPercent,
        dpAmount: calculated,
      });
    }
  }, [totalAmount, localDpPercent]);

  const handleModeChange = (mode: PaymentMode) => {
    if (mode === PAYMENT_MODES.TEMPO) {
      onChange({
        mode,
        paymentTerms: PaymentTermsSchema.enum.NET30,
        withDP: false,
        dpPercent: 0,
        dpAmount: 0,
      });
    } else if (mode === PAYMENT_MODES.UPFRONT) {
      onChange({
        mode,
        paymentTerms: PaymentTermsSchema.enum.UPFRONT,
        withDP: false,
        dpPercent: 100,
        dpAmount: totalAmount,
      });
    } else {
      onChange({
        mode,
        paymentTerms: PaymentTermsSchema.enum.COD,
        withDP: false,
        dpPercent: 0,
        dpAmount: 0,
      });
    }
  };

  const handleTempoChange = (terms: string) => {
    onChange({ ...value, paymentTerms: terms });
  };

  const handleDPToggle = (checked: boolean) => {
    onChange({
      ...value,
      withDP: checked,
      dpPercent: checked ? 30 : 0,
      dpAmount: checked ? (totalAmount * 30) / 100 : 0,
    });
    if (checked) {
      setLocalDpPercent(30);
      setLocalDpAmount((totalAmount * 30) / 100);
    }
  };

  const handleDpPercentChange = (percent: number) => {
    const clamped = Math.min(99, Math.max(0, percent));
    setLocalDpPercent(clamped);
    const amount = (totalAmount * clamped) / 100;
    setLocalDpAmount(amount);
    onChange({ ...value, dpPercent: clamped, dpAmount: amount });
  };

  const handleDpAmountChange = (amount: number) => {
    const clamped = Math.min(totalAmount * 0.99, Math.max(0, amount));
    setLocalDpAmount(clamped);
    const percent =
      totalAmount > 0 ? (clamped / totalAmount) * 100 : 0;
    setLocalDpPercent(percent);
    onChange({ ...value, dpPercent: percent, dpAmount: clamped });
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mode Pembayaran
        </label>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => handleModeChange(PAYMENT_MODES.TEMPO)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              value.mode === PAYMENT_MODES.TEMPO
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tempo
          </button>
          <button
            type="button"
            onClick={() => handleModeChange(PAYMENT_MODES.UPFRONT)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-l transition-colors ${
              value.mode === PAYMENT_MODES.UPFRONT
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cash Upfront
          </button>
          <button
            type="button"
            onClick={() => handleModeChange(PAYMENT_MODES.COD)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-l transition-colors ${
              value.mode === PAYMENT_MODES.COD
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            COD
          </button>
        </div>
      </div>

      {/* Mode-specific content */}
      {value.mode === PAYMENT_MODES.TEMPO && (
        <div className="space-y-4 bg-gray-50 rounded-lg p-4">
          {/* Tempo Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jangka Waktu
            </label>
            <Select
              value={value.paymentTerms}
              onChange={(val) => handleTempoChange(val)}
              options={TEMPO_OPTIONS}
              placeholder="Pilih jangka waktu"
            />
          </div>

          {/* DP Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="withDP"
              checked={value.withDP}
              onChange={(e) => handleDPToggle(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="withDP" className="text-sm text-gray-700">
              Dengan Uang Muka (DP)
            </label>
          </div>

          {/* DP Inputs - only show if withDP */}
          {value.withDP && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DP Persen (%)
                  </label>
                  <QuantityInput
                    min={1}
                    max={99}
                    value={Math.round(localDpPercent)}
                    onChange={(val) => handleDpPercentChange(val)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DP Nominal
                  </label>
                  <CurrencyInput
                    min={0}
                    max={totalAmount * 0.99}
                    value={Math.round(localDpAmount)}
                    onChange={(val) => handleDpAmountChange(val)}
                  />
                </div>
              </div>
              <div className="text-sm text-blue-800">
                <div className="flex justify-between">
                  <span>DP dibayar di muka:</span>
                  <span className="font-medium">
                    {formatCurrency(localDpAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sisa (tempo {value.paymentTerms}):</span>
                  <span className="font-medium">
                    {formatCurrency(totalAmount - localDpAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {value.mode === PAYMENT_MODES.UPFRONT && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💳</span>
            <div className="flex-1">
              <h4 className="font-medium text-green-900">
                Pembayaran 100% di Muka
              </h4>
              <p className="text-sm text-green-700 mt-1">
                Barang tidak akan dikirim sebelum pembayaran lunas.
              </p>
              <div className="mt-3 text-sm">
                <div className="flex justify-between text-green-800">
                  <span>Total Pesanan:</span>
                  <span className="font-semibold">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-green-900 font-medium">
                  <span>Harus Dibayar:</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {value.mode === PAYMENT_MODES.COD && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚚</span>
            <div className="flex-1">
              <h4 className="font-medium text-orange-900">
                Bayar Saat Barang Diterima
              </h4>
              <p className="text-sm text-orange-700 mt-1">
                Pembayaran dilakukan saat barang tiba (Goods Receipt).
              </p>
            </div>
          </div>

          {/* DP Toggle for COD */}
          <div className="flex items-center gap-2 pt-3 border-t border-orange-200">
            <input
              type="checkbox"
              id="codWithDP"
              checked={value.withDP}
              onChange={(e) => handleDPToggle(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <label
              htmlFor="codWithDP"
              className="text-sm text-gray-700"
            >
              Dengan Uang Muka (DP)
            </label>
          </div>

          {/* DP Inputs for COD */}
          {value.withDP && (
            <div className="bg-orange-100 border border-orange-300 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DP Persen (%)
                  </label>
                  <QuantityInput
                    min={1}
                    max={99}
                    value={Math.round(localDpPercent)}
                    onChange={(val) => handleDpPercentChange(val)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DP Nominal
                  </label>
                  <CurrencyInput
                    min={0}
                    max={totalAmount * 0.99}
                    value={Math.round(localDpAmount)}
                    onChange={(val) => handleDpAmountChange(val)}
                  />
                </div>
              </div>
              <div className="text-sm text-orange-800">
                <div className="flex justify-between">
                  <span>DP dibayar di muka:</span>
                  <span className="font-medium">
                    {formatCurrency(localDpAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sisa dibayar saat GRN:</span>
                  <span className="font-medium">
                    {formatCurrency(totalAmount - localDpAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment breakdown - only show if no DP */}
          {!value.withDP && (
            <div className="text-sm">
              <div className="flex justify-between text-orange-800">
                <span>Total Pesanan:</span>
                <span className="font-semibold">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-orange-900 font-medium">
                <span>Dibayar saat GRN:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
