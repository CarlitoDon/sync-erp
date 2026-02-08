import {
  RentalOrderStatus,
  RentalPaymentStatus,
  UnitStatus,
  UnitCondition,
  PaymentMethod,
} from '@sync-erp/shared';

// ============================================
// Order Status
// ============================================

export const ORDER_STATUS_COLORS: Record<RentalOrderStatus, string> =
  {
    [RentalOrderStatus.DRAFT]: 'bg-gray-100 text-gray-800',
    [RentalOrderStatus.CONFIRMED]: 'bg-yellow-100 text-yellow-800',
    [RentalOrderStatus.ACTIVE]: 'bg-green-100 text-green-800',
    [RentalOrderStatus.COMPLETED]: 'bg-blue-100 text-blue-800',
    [RentalOrderStatus.CANCELLED]: 'bg-red-100 text-red-800',
  };

export const ORDER_STATUS_LABELS: Record<RentalOrderStatus, string> =
  {
    [RentalOrderStatus.DRAFT]: 'Draft',
    [RentalOrderStatus.CONFIRMED]: 'Dikonfirmasi',
    [RentalOrderStatus.ACTIVE]: 'Aktif',
    [RentalOrderStatus.COMPLETED]: 'Selesai',
    [RentalOrderStatus.CANCELLED]: 'Dibatalkan',
  };

// ============================================
// Unit Status
// ============================================

export const UNIT_STATUS_COLORS: Record<UnitStatus, string> = {
  [UnitStatus.AVAILABLE]: 'bg-green-100 text-green-800',
  [UnitStatus.RESERVED]: 'bg-yellow-100 text-yellow-800',
  [UnitStatus.RENTED]: 'bg-blue-100 text-blue-800',
  [UnitStatus.RETURNED]: 'bg-purple-100 text-purple-800',
  [UnitStatus.CLEANING]: 'bg-orange-100 text-orange-800',
  [UnitStatus.MAINTENANCE]: 'bg-red-100 text-red-800',
  [UnitStatus.RETIRED]: 'bg-gray-100 text-gray-800',
};

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  [UnitStatus.AVAILABLE]: 'Tersedia',
  [UnitStatus.RESERVED]: 'Dipesan',
  [UnitStatus.RENTED]: 'Disewa',
  [UnitStatus.RETURNED]: 'Dikembalikan',
  [UnitStatus.CLEANING]: 'Dibersihkan',
  [UnitStatus.MAINTENANCE]: 'Maintenance',
  [UnitStatus.RETIRED]: 'Retired',
};

// ============================================
// Unit Condition
// ============================================

export const CONDITION_COLORS: Record<UnitCondition, string> = {
  [UnitCondition.NEW]: 'bg-green-100 text-green-800',
  [UnitCondition.GOOD]: 'bg-blue-100 text-blue-800',
  [UnitCondition.FAIR]: 'bg-yellow-100 text-yellow-800',
  [UnitCondition.NEEDS_REPAIR]: 'bg-red-100 text-red-800',
};

export const CONDITION_OPTIONS = [
  {
    value: UnitCondition.NEW,
    label: 'Baru/Sempurna',
    color: 'bg-green-100 text-green-800',
  },
  {
    value: UnitCondition.GOOD,
    label: 'Baik',
    color: 'bg-blue-100 text-blue-800',
  },
  {
    value: UnitCondition.FAIR,
    label: 'Cukup',
    color: 'bg-yellow-100 text-yellow-800',
  },
  {
    value: UnitCondition.NEEDS_REPAIR,
    label: 'Perlu Perbaikan',
    color: 'bg-red-100 text-red-800',
  },
] as const;

// ============================================
// Damage Severity
// ============================================

export const DAMAGE_SEVERITY_OPTIONS = [
  { value: '', label: 'Tidak Ada Kerusakan' },
  { value: 'MINOR', label: 'Ringan' },
  { value: 'MAJOR', label: 'Sedang' },
  { value: 'UNUSABLE', label: 'Tidak Bisa Dipakai' },
] as const;

// ============================================
// Payment Method
// ============================================

export const PAYMENT_METHOD_OPTIONS = [
  { value: PaymentMethod.CASH, label: 'Tunai' },
  { value: PaymentMethod.BANK, label: 'Transfer Bank' },
  { value: PaymentMethod.QRIS, label: 'QRIS' },
] as const;

// ============================================
// Rental Payment Status
// ============================================

export const PAYMENT_STATUS_COLORS: Record<
  RentalPaymentStatus,
  string
> = {
  [RentalPaymentStatus.PENDING]: 'bg-gray-100 text-gray-700',
  [RentalPaymentStatus.AWAITING_CONFIRM]:
    'bg-yellow-100 text-yellow-800',
  [RentalPaymentStatus.CONFIRMED]: 'bg-green-100 text-green-800',
  [RentalPaymentStatus.FAILED]: 'bg-red-100 text-red-800',
};

export const PAYMENT_STATUS_LABELS: Record<
  RentalPaymentStatus,
  string
> = {
  [RentalPaymentStatus.PENDING]: 'Belum Bayar',
  [RentalPaymentStatus.AWAITING_CONFIRM]: 'Menunggu Verifikasi',
  [RentalPaymentStatus.CONFIRMED]: 'Lunas',
  [RentalPaymentStatus.FAILED]: 'Gagal',
};
