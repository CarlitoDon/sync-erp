import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import {
  UnitStatus,
  PartnerType,
  OrderDiscount,
  calculateCrossInventoryDemand,
  calculateRemainingForLine,
  calculateTotalMattressesInOrder,
} from '@sync-erp/shared';
import { toast } from 'react-hot-toast';
import { useRentalPricing, useRentalDays } from './useRentalPricing';
import { DecimalLike, toNumber } from '@/types/decimal';

interface OrderItem {
  type: 'item' | 'bundle';
  rentalItemId?: string;
  rentalBundleId?: string;
  quantity: number | '';
  pricePerDay?: number;
}

export type { OrderItem };

export interface EditableRentalOrderItem {
  rentalItemId?: string | null;
  rentalBundleId?: string | null;
  quantity?: DecimalLike;
  unitPrice?: DecimalLike;
}

export interface EditableRentalOrder {
  id: string;
  orderNumber?: string;
  partnerId?: string | null;
  rentalStartDate: Date | string;
  rentalEndDate: Date | string;
  dueDateTime?: Date | string | null;
  notes?: string | null;
  deliveryFee?: DecimalLike;
  discountAmount?: DecimalLike;
  discountLabel?: string | null;
  policySnapshot?: unknown;
  depositAmount?: DecimalLike;
  deliveryAddress?: string | null;
  street?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  provinsi?: string | null;
  zip?: string | null;
  latitude?: DecimalLike;
  longitude?: DecimalLike;
  items?: EditableRentalOrderItem[];
}

export interface CreateOrderFormState {
  partnerId: string;
  rentalStartDate: string;
  deliveryTime: string;
  rentalEndDate: string;
  pickupTime: string;
  dueDateTime: string;
  notes: string;
  deliveryFee: string;
  discountAmount: string;
  discounts: OrderDiscount[];
  deliveryAddress: string;
  street: string;
  kelurahan: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  saveToCustomerAddresses: boolean;
  saveAsDefaultAddress?: boolean;
  addressName?: string;
  selectedCustomerAddressId: string;
  requiresDeposit: boolean;
  depositAmount: string;
  upstairsMattressCount: string;
  fittedSheetCount: string;
  googleMapsUrl: string;
  items: OrderItem[];
}

interface UseCreateOrderParams {
  isOpen: boolean;
  initialItemId?: string;
  editingOrder?: EditableRentalOrder | null;
  onSuccess?: () => void;
  onClose: () => void;
}

export function parseOrderToFormState(
  order: EditableRentalOrder | null | undefined,
  initialItemId?: string
): CreateOrderFormState {
  if (!order) {
    return {
      partnerId: '',
      rentalStartDate: new Date().toISOString().split('T')[0],
      deliveryTime: '07:00', // Default 7 AM as requested by user
      rentalEndDate: '',
      pickupTime: '18:00',
      dueDateTime: '',
      notes: '',
      deliveryFee: '',
      discountAmount: '',
      discounts: [],
      deliveryAddress: '',
      street: '',
      kelurahan: '',
      kecamatan: '',
      kota: '',
      provinsi: '',
      zip: '',
      latitude: null,
      longitude: null,
      saveToCustomerAddresses: true,
      saveAsDefaultAddress: false,
      addressName: '',
      selectedCustomerAddressId: '',
      requiresDeposit: false,
      depositAmount: '',
      upstairsMattressCount: '',
      fittedSheetCount: '',
      googleMapsUrl: '',
      items: initialItemId
        ? [{ type: 'item', rentalItemId: initialItemId, quantity: 1 }]
        : [],
    };
  }

  const startIso =
    typeof order.rentalStartDate === 'string'
      ? order.rentalStartDate
      : new Date(order.rentalStartDate).toISOString();
  const endIso =
    typeof order.rentalEndDate === 'string'
      ? order.rentalEndDate
      : new Date(order.rentalEndDate).toISOString();

  const startDatePart = startIso.split('T')[0];
  const endDatePart = endIso.split('T')[0];

  const notesText = order.notes || '';
  const deliveryTimeMatch = notesText.match(/jam antar:\s*(\d{1,2}:\d{2})/i);
  let deliveryTime = '07:00';
  if (deliveryTimeMatch) {
    deliveryTime = deliveryTimeMatch[1].padStart(5, '0');
  } else if (startIso.includes('T')) {
    const d = new Date(startIso);
    deliveryTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const pickupTimeMatch = notesText.match(/jam ambil:\s*(\d{1,2}:\d{2})/i);
  let pickupTime = '18:00';
  if (pickupTimeMatch) {
    pickupTime = pickupTimeMatch[1].padStart(5, '0');
  } else if (endIso.includes('T')) {
    const d = new Date(endIso);
    pickupTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const upstairsMatch = notesText.match(
    /(?:kasur\s+)?naik(?:\s+ke)?\s+lantai(?:\s*(?:atas|\d+))?:\s*(\d+)/i
  );
  const upstairsCount = upstairsMatch ? upstairsMatch[1] : '';

  const fittedMatch = notesText.match(
    /(?:kasur\s+)?(?:dipasang|pasang)\s+sprei(?:nya)?:\s*(\d+)/i
  );
  const fittedCount = fittedMatch ? fittedMatch[1] : '';

  const fullText = `${order.deliveryAddress || ''}\n${notesText}`;
  const mapsRegex =
    /(https?:\/\/(?:www\.)?(?:google\.com\/maps[^\s]+|maps\.google\.com[^\s]+|maps\.app\.goo\.gl[^\s]+|goo\.gl\/maps[^\s]+))/i;
  const mapsMatch = fullText.match(mapsRegex);
  const mapsExplicit = fullText.match(
    /(?:Maps|Titik Google Maps):\s*(https?:\/\/[^\s]+)/i
  );
  const googleMapsUrl = mapsMatch
    ? mapsMatch[1]
    : mapsExplicit
      ? mapsExplicit[1]
      : '';

  const cleanDeliveryAddress = (order.deliveryAddress || '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^(?:maps|titik google maps)\s*:\s*https?:\/\//i.test(trimmed))
        return false;
      if (
        /^https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
          trimmed
        )
      )
        return false;
      return true;
    })
    .join('\n')
    .trim();

  const cleanNotes = notesText
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^jam antar\s*:/i.test(trimmed)) return false;
      if (/^jam ambil\s*:/i.test(trimmed)) return false;
      if (/^(?:kasur\s+)?naik(?:\s+ke)?\s+lantai(?:\s*(?:atas|\d+))?\s*:/i.test(trimmed))
        return false;
      if (/^(?:kasur\s+)?(?:dipasang|pasang)\s+sprei(?:nya)?\s*:/i.test(trimmed))
        return false;
      if (/^titik google maps\s*:/i.test(trimmed)) return false;
      if (/^deposit \/ uang jaminan\s*:/i.test(trimmed)) return false;
      if (/^maps\s*:\s*https?:\/\//i.test(trimmed)) return false;
      if (/^ongkos kirim dasar\s*:/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .trim();

  const items: OrderItem[] = (order.items || []).map((it) => ({
    type: it.rentalBundleId ? 'bundle' : 'item',
    rentalItemId: it.rentalItemId || undefined,
    rentalBundleId: it.rentalBundleId || undefined,
    quantity: toNumber(it.quantity) || 1,
    pricePerDay:
      it.unitPrice !== null && it.unitPrice !== undefined
        ? toNumber(it.unitPrice)
        : undefined,
  }));

  const depositNum = toNumber(order.depositAmount);

  const baseDeliveryMatch = notesText.match(
    /ongkos kirim dasar:\s*rp\s*([\d.]+)/i
  );
  let parsedDeliveryFee = '';
  if (baseDeliveryMatch) {
    parsedDeliveryFee = baseDeliveryMatch[1].replace(/\./g, '');
  } else if (order.deliveryFee !== null && order.deliveryFee !== undefined) {
    const totalDeliv = toNumber(order.deliveryFee);
    const upFee = Number(upstairsCount || 0) * 3500;
    const fitFee = Number(fittedCount || 0) * 2000;
    const estimatedBase = totalDeliv - upFee - fitFee;
    parsedDeliveryFee =
      estimatedBase >= 0 && (upFee > 0 || fitFee > 0)
        ? String(estimatedBase)
        : String(totalDeliv);
  }

  return {
    partnerId: order.partnerId || '',
    rentalStartDate: startDatePart,
    deliveryTime,
    rentalEndDate: endDatePart,
    pickupTime,
    dueDateTime: order.dueDateTime
      ? typeof order.dueDateTime === 'string'
        ? order.dueDateTime
        : new Date(order.dueDateTime).toISOString()
      : '',
    notes: cleanNotes,
    deliveryFee: parsedDeliveryFee,
    discountAmount:
      order.discountAmount !== null && order.discountAmount !== undefined
        ? String(toNumber(order.discountAmount))
        : '',
    discounts:
      Array.isArray((order.policySnapshot as Record<string, unknown>)?.discounts)
        ? ((order.policySnapshot as Record<string, unknown>).discounts as OrderDiscount[])
        : order.discountAmount && Number(toNumber(order.discountAmount)) > 0
        ? [
            {
              id: 'initial-discount',
              label: order.discountLabel || 'Diskon',
              type: 'FIXED' as const,
              value: Number(toNumber(order.discountAmount)),
              target: 'ORDER' as const,
              amount: Number(toNumber(order.discountAmount)),
            },
          ]
        : [],
    deliveryAddress: cleanDeliveryAddress || order.street || '',
    street: order.street || '',
    kelurahan: order.kelurahan || '',
    kecamatan: order.kecamatan || '',
    kota: order.kota || '',
    provinsi: order.provinsi || '',
    zip: order.zip || '',
    latitude:
      order.latitude !== null && order.latitude !== undefined
        ? toNumber(order.latitude)
        : null,
    longitude:
      order.longitude !== null && order.longitude !== undefined
        ? toNumber(order.longitude)
        : null,
    saveToCustomerAddresses: false,
    saveAsDefaultAddress: false,
    addressName: '',
    selectedCustomerAddressId: '',
    requiresDeposit: depositNum > 0,
    depositAmount: depositNum > 0 ? String(depositNum) : '',
    upstairsMattressCount: upstairsCount,
    fittedSheetCount: fittedCount,
    googleMapsUrl,
    items,
  };
}

export function useCreateOrder({
  isOpen,
  initialItemId,
  editingOrder,
  onSuccess,
  onClose,
}: UseCreateOrderParams) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Queries
  const { data: rentalItems = [], isLoading: isLoadingItems } =
    trpc.rental.items.list.useQuery(undefined, {
      enabled: isOpen && !!currentCompany?.id,
    });
  const { data: partners = [], isLoading: isLoadingPartners } =
    trpc.partner.list.useQuery(undefined, {
      enabled: isOpen && !!currentCompany?.id,
    });
  const { data: rentalBundles = [] } =
    trpc.rentalBundle.list.useQuery(
      {},
      { enabled: isOpen && !!currentCompany?.id }
    );
  const { data: rentalPolicy } =
    trpc.rental.policy.getCurrent.useQuery(undefined, {
      enabled: isOpen && !!currentCompany?.id,
    });

  const upstairsFeePerUnit =
    rentalPolicy?.upstairsFeePerUnit !== undefined &&
    rentalPolicy?.upstairsFeePerUnit !== null
      ? Number(rentalPolicy.upstairsFeePerUnit)
      : 3500;

  const fittedSheetFeePerUnit =
    rentalPolicy?.fittedSheetFeePerUnit !== undefined &&
    rentalPolicy?.fittedSheetFeePerUnit !== null
      ? Number(rentalPolicy.fittedSheetFeePerUnit)
      : 2000;

  const isLoadingData = isLoadingItems || isLoadingPartners;

  const getInitialFormState = useCallback(
    (): CreateOrderFormState =>
      parseOrderToFormState(editingOrder, initialItemId),
    [editingOrder, initialItemId]
  );

  // Form state
  const [orderForm, setOrderForm] = useState<CreateOrderFormState>(
    getInitialFormState
  );

  const [createdCustomers, setCreatedCustomers] = useState<
    { id: string; name: string; phone?: string | null; address?: string | null }[]
  >([]);

  // Query addresses for selected customer
  const { data: partnerAddresses = [] } =
    trpc.partner.listAddresses.useQuery(
      { partnerId: orderForm.partnerId },
      { enabled: isOpen && !!currentCompany?.id && !!orderForm.partnerId }
    );

  const createAddressMutation = trpc.partner.createAddress.useMutation();

  // When modal opens or editingOrder / initialItemId changes, cleanly reset and initialize form
  useEffect(() => {
    if (isOpen) {
      setOrderForm(parseOrderToFormState(editingOrder, initialItemId));
    }
  }, [isOpen, editingOrder, initialItemId]);

  // When partnerAddresses load and an address isn't chosen yet, auto-select default address (only in create mode)
  useEffect(() => {
    if (
      !editingOrder &&
      orderForm.partnerId &&
      partnerAddresses.length > 0 &&
      !orderForm.selectedCustomerAddressId &&
      !orderForm.deliveryAddress
    ) {
      const defaultAddr =
        partnerAddresses.find((a) => a.isDefault) || partnerAddresses[0];
      if (defaultAddr) {
        setOrderForm((prev) => ({
          ...prev,
          selectedCustomerAddressId: defaultAddr.id,
          street: defaultAddr.street || '',
          kelurahan: defaultAddr.kelurahan || '',
          kecamatan: defaultAddr.kecamatan || '',
          kota: defaultAddr.kota || '',
          provinsi: defaultAddr.provinsi || '',
          zip: defaultAddr.zip || '',
          latitude: defaultAddr.latitude ? Number(defaultAddr.latitude) : null,
          longitude: defaultAddr.longitude ? Number(defaultAddr.longitude) : null,
          deliveryAddress: defaultAddr.address || defaultAddr.street || '',
          googleMapsUrl:
            defaultAddr.latitude && defaultAddr.longitude
              ? `https://www.google.com/maps?q=${defaultAddr.latitude},${defaultAddr.longitude}`
              : prev.googleMapsUrl,
        }));
      }
    }
  }, [
    editingOrder,
    orderForm.partnerId,
    orderForm.selectedCustomerAddressId,
    orderForm.deliveryAddress,
    partnerAddresses,
  ]);

  // Date-based availability check
  const hasValidDateRange =
    Boolean(orderForm.rentalStartDate) &&
    Boolean(orderForm.rentalEndDate) &&
    new Date(orderForm.rentalEndDate) >= new Date(orderForm.rentalStartDate);

  const availabilityStartDate = useMemo(() => {
    if (!orderForm.rentalStartDate) return new Date();
    return new Date(
      `${orderForm.rentalStartDate}T${orderForm.deliveryTime || '07:00'}:00`
    );
  }, [orderForm.rentalStartDate, orderForm.deliveryTime]);

  const availabilityEndDate = useMemo(() => {
    if (!orderForm.rentalEndDate) return new Date();
    return new Date(
      `${orderForm.rentalEndDate}T${orderForm.pickupTime || '18:00'}:00`
    );
  }, [orderForm.rentalEndDate, orderForm.pickupTime]);

  const { data: availabilityMap } = trpc.rental.availability.check.useQuery(
    {
      startDate: availabilityStartDate,
      endDate: availabilityEndDate,
    },
    {
      enabled: isOpen && !!currentCompany?.id && hasValidDateRange,
    }
  );

  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Pricing calculations
  const rentalDays = useRentalDays(
    orderForm.rentalStartDate,
    orderForm.rentalEndDate
  );
  const { subtotal, depositRequired } = useRentalPricing(
    orderForm.items,
    rentalItems,
    rentalDays,
    rentalBundles
  );

  // Mutations
  const createMutation = trpc.rental.orders.create.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      onSuccess?.();
      handleClose();
    },
  });

  const updateMutation = trpc.rental.orders.update.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      if (editingOrder?.id) {
        utils.rental.orders.getById.invalidate({ id: editingOrder.id });
      }
      onSuccess?.();
      handleClose();
    },
  });

  // Derived - merges partners with newly quick-created customers immediately
  const customers = useMemo(() => {
    const list = partners.filter((p) => p.type === PartnerType.CUSTOMER);
    const existingIds = new Set(list.map((p) => p.id));
    const extra = createdCustomers
      .filter((c) => !existingIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || null,
        address: c.address || null,
        type: PartnerType.CUSTOMER,
        companyId: currentCompany?.id || '',
        email: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    return [...extra, ...list];
  }, [partners, createdCustomers, currentCompany?.id]);

  // Dirty detection for unsaved changes guard
  const isDirty = useMemo(() => {
    if (editingOrder) {
      const initial = parseOrderToFormState(editingOrder, initialItemId);
      return JSON.stringify(orderForm) !== JSON.stringify(initial);
    }

    const isStartDateChanged =
      orderForm.rentalStartDate !==
      new Date().toISOString().split('T')[0];
    const isItemsChanged =
      orderForm.items.length > (initialItemId ? 1 : 0) ||
      (orderForm.items.length === 1 &&
        initialItemId !== undefined &&
        (orderForm.items[0].rentalItemId !== initialItemId ||
          orderForm.items[0].quantity !== 1 ||
          orderForm.items[0].pricePerDay !== undefined ||
          orderForm.items[0].type !== 'item')) ||
      (orderForm.items.length > 0 && initialItemId === undefined);

    return (
      Boolean(orderForm.partnerId) ||
      isStartDateChanged ||
      Boolean(orderForm.rentalEndDate) ||
      orderForm.deliveryTime !== '07:00' ||
      orderForm.pickupTime !== '18:00' ||
      Boolean(orderForm.notes?.trim()) ||
      Boolean(orderForm.deliveryFee) ||
      Boolean(orderForm.discountAmount) ||
      (orderForm.discounts?.length || 0) > 0 ||
      Boolean(orderForm.deliveryAddress?.trim()) ||
      Boolean(orderForm.street?.trim()) ||
      Boolean(orderForm.upstairsMattressCount) ||
      Boolean(orderForm.fittedSheetCount) ||
      Boolean(orderForm.googleMapsUrl?.trim()) ||
      orderForm.requiresDeposit ||
      Boolean(orderForm.depositAmount) ||
      isItemsChanged
    );
  }, [orderForm, initialItemId, editingOrder]);

  // Handlers
  const resetForm = useCallback(() => {
    setOrderForm(getInitialFormState());
  }, [getInitialFormState]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const addItem = useCallback(() => {
    setOrderForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { type: 'item', rentalItemId: '', quantity: 1 },
      ],
    }));
  }, []);

  const updateItem = useCallback(
    (
      idx: number,
      field: keyof OrderItem,
      value: string | number | undefined | 'item' | 'bundle'
    ) => {
      setOrderForm((prev) => {
        const newItems = [...prev.items];
        newItems[idx] = { ...newItems[idx], [field]: value };
        return { ...prev, items: newItems };
      });
    },
    []
  );

  const updateItemType = useCallback(
    (idx: number, newType: 'item' | 'bundle') => {
      setOrderForm((prev) => {
        const newItems = [...prev.items];
        newItems[idx] = {
          ...newItems[idx],
          type: newType,
          rentalItemId: '',
          rentalBundleId: '',
        };
        return { ...prev, items: newItems };
      });
    },
    []
  );

  // Unified select handler for merged Item / Bundle dropdown
  const updateItemUnified = useCallback((idx: number, compositeValue: string) => {
    setOrderForm((prev) => {
      const newItems = [...prev.items];
      if (compositeValue.startsWith('bundle:')) {
        const bundleId = compositeValue.slice(7);
        newItems[idx] = {
          ...newItems[idx],
          type: 'bundle',
          rentalBundleId: bundleId,
          rentalItemId: undefined,
        };
      } else if (compositeValue.startsWith('item:')) {
        const itemId = compositeValue.slice(5);
        newItems[idx] = {
          ...newItems[idx],
          type: 'item',
          rentalItemId: itemId,
          rentalBundleId: undefined,
        };
      } else {
        newItems[idx] = {
          ...newItems[idx],
          rentalItemId: undefined,
          rentalBundleId: undefined,
        };
      }
      return { ...prev, items: newItems };
    });
  }, []);

  // Backspace-friendly quantity updater
  const updateItemQuantity = useCallback((idx: number, rawValue: string | number) => {
    setOrderForm((prev) => {
      const newItems = [...prev.items];
      if (rawValue === '') {
        newItems[idx] = { ...newItems[idx], quantity: '' };
      } else {
        const parsed = parseInt(String(rawValue));
        newItems[idx] = {
          ...newItems[idx],
          quantity: isNaN(parsed) ? '' : Math.max(1, parsed),
        };
      }
      return { ...prev, items: newItems };
    });
  }, []);

  const removeItem = useCallback((idx: number) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }, []);

  // Multiple Discounts Calculation & Handlers
  const computedDiscounts = useMemo(() => {
    const rawDeliveryFee = Number(orderForm.deliveryFee) || 0;
    return (orderForm.discounts || []).map((d) => {
      let amount = d.value;
      if (d.type === 'PERCENTAGE') {
        let base = subtotal;
        if (d.target === 'DELIVERY') base = rawDeliveryFee;
        else if (d.target === 'ORDER') base = subtotal + rawDeliveryFee;
        amount = Math.round((base * d.value) / 100);
      }
      // Safety cap so discount cannot exceed target
      if (d.target === 'DELIVERY') {
        amount = Math.min(amount, rawDeliveryFee);
      } else if (d.target === 'RENTAL') {
        amount = Math.min(amount, subtotal);
      } else {
        amount = Math.min(amount, subtotal + rawDeliveryFee);
      }
      return {
        ...d,
        amount: Math.max(0, amount),
      };
    });
  }, [orderForm.discounts, subtotal, orderForm.deliveryFee]);

  const totalDiscountAmount = useMemo(() => {
    if (computedDiscounts.length > 0) {
      return computedDiscounts.reduce((acc, d) => acc + d.amount, 0);
    }
    return Number(orderForm.discountAmount) || 0;
  }, [computedDiscounts, orderForm.discountAmount]);

  const addDiscount = useCallback(
    (discount: Omit<OrderDiscount, 'id' | 'amount'> & { id?: string; amount?: number }) => {
      const id = discount.id || `disc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const amount = discount.amount ?? discount.value;
      setOrderForm((prev) => ({
        ...prev,
        discountAmount: '',
        discounts: [...(prev.discounts || []), { ...discount, id, amount }],
      }));
    },
    []
  );

  const removeDiscount = useCallback((id: string) => {
    setOrderForm((prev) => ({
      ...prev,
      discounts: (prev.discounts || []).filter((d) => d.id !== id),
    }));
  }, []);

  const updateDiscount = useCallback((id: string, partial: Partial<OrderDiscount>) => {
    setOrderForm((prev) => ({
      ...prev,
      discounts: (prev.discounts || []).map((d) => (d.id === id ? { ...d, ...partial } : d)),
    }));
  }, []);

  const applyPresetDiscount = useCallback(
    (preset: 'FREE_DELIVERY' | 'PERCENT_10' | 'PERCENT_5' | 'CUSTOM') => {
      const rawDeliveryFee = Number(orderForm.deliveryFee) || 0;
      if (preset === 'FREE_DELIVERY') {
        addDiscount({
          label: 'Gratis Ongkir',
          type: 'PERCENTAGE',
          value: 100,
          target: 'DELIVERY',
          amount: rawDeliveryFee,
        });
      } else if (preset === 'PERCENT_10') {
        addDiscount({
          label: 'Diskon Sewa 10%',
          type: 'PERCENTAGE',
          value: 10,
          target: 'RENTAL',
          amount: Math.round((subtotal * 10) / 100),
        });
      } else if (preset === 'PERCENT_5') {
        addDiscount({
          label: 'Diskon Sewa 5%',
          type: 'PERCENTAGE',
          value: 5,
          target: 'RENTAL',
          amount: Math.round((subtotal * 5) / 100),
        });
      } else {
        addDiscount({
          label: 'Diskon Khusus',
          type: 'FIXED',
          value: 0,
          target: 'ORDER',
          amount: 0,
        });
      }
    },
    [addDiscount, orderForm.deliveryFee, subtotal]
  );

  const getAvailableUnits = useCallback(
    (itemId: string) => {
      if (
        hasValidDateRange &&
        availabilityMap &&
        availabilityMap[itemId] !== undefined
      ) {
        return availabilityMap[itemId];
      }
      const item = rentalItems.find((ri) => ri.id === itemId);
      return (
        item?.units?.filter(
          (u) =>
            u.status !== UnitStatus.MAINTENANCE &&
            u.status !== UnitStatus.RETIRED
        ).length || 0
      );
    },
    [availabilityMap, hasValidDateRange, rentalItems]
  );

  const getBundleAvailableUnits = useCallback(
    (bundleId: string): number => {
      const bundle = rentalBundles.find((b) => b.id === bundleId);
      if (!bundle || !bundle.components || bundle.components.length === 0) {
        return 0;
      }
      const componentAvailabilities = bundle.components.map((c) => {
        const availableForItem = getAvailableUnits(c.rentalItemId);
        const requiredPerBundle = c.quantity || 1;
        return Math.floor(availableForItem / requiredPerBundle);
      });
      return Math.max(0, Math.min(...componentAvailabilities));
    },
    [rentalBundles, getAvailableUnits]
  );

  const totalMattressesInOrder = useMemo(() => {
    return calculateTotalMattressesInOrder(
      orderForm.items,
      rentalItems,
      rentalBundles
    );
  }, [orderForm.items, rentalItems, rentalBundles]);

  // Auto-clamp upstairsMattressCount and fittedSheetCount if total mattresses in order decreases
  useEffect(() => {
    setOrderForm((prev) => {
      let changed = false;
      let newUpstairs = prev.upstairsMattressCount;
      let newFitted = prev.fittedSheetCount;

      if (newUpstairs && Number(newUpstairs) > totalMattressesInOrder) {
        newUpstairs =
          totalMattressesInOrder === 0 ? '' : String(totalMattressesInOrder);
        changed = true;
      }
      if (newFitted && Number(newFitted) > totalMattressesInOrder) {
        newFitted =
          totalMattressesInOrder === 0 ? '' : String(totalMattressesInOrder);
        changed = true;
      }

      if (!changed) return prev;
      return {
        ...prev,
        upstairsMattressCount: newUpstairs,
        fittedSheetCount: newFitted,
      };
    });
  }, [totalMattressesInOrder]);

  const upstairsMattressCountNum = Number(orderForm.upstairsMattressCount || 0);
  const fittedSheetCountNum = Number(orderForm.fittedSheetCount || 0);
  const upstairsTotalFee = upstairsMattressCountNum * upstairsFeePerUnit;
  const fittedSheetTotalFee = fittedSheetCountNum * fittedSheetFeePerUnit;
  const specialServicesTotalFee = upstairsTotalFee + fittedSheetTotalFee;

  const crossDemandResult = useMemo(() => {
    return calculateCrossInventoryDemand({
      items: orderForm.items,
      rentalItems,
      rentalBundles,
      availabilityMap,
      getAvailableUnits,
    });
  }, [
    orderForm.items,
    rentalItems,
    rentalBundles,
    availabilityMap,
    getAvailableUnits,
  ]);

  const stockConflicts = crossDemandResult.conflicts;
  const hasStockError = crossDemandResult.hasConflict;

  const getDynamicRemainingForLine = useCallback(
    (
      lineIdx: number,
      targetType: 'item' | 'bundle',
      targetId: string
    ): number => {
      return calculateRemainingForLine({
        lineIdx,
        targetType,
        targetId,
        items: orderForm.items,
        rentalItems,
        rentalBundles,
        availabilityMap,
        getAvailableUnits,
      });
    },
    [
      orderForm.items,
      rentalItems,
      rentalBundles,
      availabilityMap,
      getAvailableUnits,
    ]
  );

  const updateFormField = useCallback(
    <K extends keyof CreateOrderFormState>(
      field: K,
      value: CreateOrderFormState[K]
    ) => {
      setOrderForm((prev) => {
        if (field === 'partnerId') {
          const newPartnerId = String(value);
          if (newPartnerId !== prev.partnerId) {
            return {
              ...prev,
              partnerId: newPartnerId,
              selectedCustomerAddressId: '',
              deliveryAddress: '',
              street: '',
              kelurahan: '',
              kecamatan: '',
              kota: '',
              provinsi: '',
              zip: '',
              latitude: null,
              longitude: null,
              googleMapsUrl: '',
            };
          }
          return prev;
        }
        return { ...prev, [field]: value };
      });
    },
    []
  );

  const applyLocationData = useCallback(
    (loc: {
      latitude: number;
      longitude: number;
      street: string;
      kelurahan: string;
      kecamatan: string;
      kota: string;
      provinsi: string;
      zip: string;
      fullAddress: string;
    }) => {
      setOrderForm((prev) => ({
        ...prev,
        latitude: loc.latitude,
        longitude: loc.longitude,
        street: loc.street,
        kelurahan: loc.kelurahan,
        kecamatan: loc.kecamatan,
        kota: loc.kota,
        provinsi: loc.provinsi,
        zip: loc.zip,
        deliveryAddress: loc.fullAddress || loc.street,
        googleMapsUrl:
          prev.googleMapsUrl ||
          `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
      }));
    },
    []
  );

  const selectSavedAddress = useCallback(
    (addressId: string) => {
      if (!addressId) {
        setOrderForm((prev) => ({
          ...prev,
          selectedCustomerAddressId: '',
          street: '',
          kelurahan: '',
          kecamatan: '',
          kota: '',
          provinsi: '',
          zip: '',
          latitude: null,
          longitude: null,
          deliveryAddress: '',
          googleMapsUrl: '',
        }));
        return;
      }
      const addr = partnerAddresses.find((a) => a.id === addressId);
      if (!addr) return;
      setOrderForm((prev) => ({
        ...prev,
        selectedCustomerAddressId: addressId,
        street: addr.street || '',
        kelurahan: addr.kelurahan || '',
        kecamatan: addr.kecamatan || '',
        kota: addr.kota || '',
        provinsi: addr.provinsi || '',
        zip: addr.zip || '',
        latitude: addr.latitude ? Number(addr.latitude) : null,
        longitude: addr.longitude ? Number(addr.longitude) : null,
        deliveryAddress: addr.address || addr.street || '',
        googleMapsUrl:
          addr.latitude && addr.longitude
            ? `https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`
            : prev.googleMapsUrl,
      }));
    },
    [partnerAddresses]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (orderForm.items.length === 0) {
        toast.error('Tambahkan minimal satu item rental');
        return;
      }
      if (!orderForm.rentalStartDate || !orderForm.rentalEndDate) {
        toast.error('Tanggal sewa harus diisi lengkap');
        return;
      }

      const startDateTime = new Date(
        `${orderForm.rentalStartDate}T${orderForm.deliveryTime || '07:00'}:00`
      );
      const endDateTime = new Date(
        `${orderForm.rentalEndDate}T${orderForm.pickupTime || '18:00'}:00`
      );

      if (endDateTime <= startDateTime) {
        toast.error(
          'Waktu selesai sewa harus lebih lambat dari waktu mulai sewa'
        );
        return;
      }

      // 1. Logistics services validation: upstairs mattress and fitted sheet cannot exceed total mattresses
      if (orderForm.upstairsMattressCount) {
        const num = Number(orderForm.upstairsMattressCount);
        if (num < 0) {
          toast.error('Jumlah kasur naik lantai tidak boleh kurang dari 0');
          return;
        }
        if (num > totalMattressesInOrder) {
          toast.error(
            `Kasur naik lantai atas (${orderForm.upstairsMattressCount}) tidak boleh melebihi total kasur (${totalMattressesInOrder})`
          );
          return;
        }
      }
      if (orderForm.fittedSheetCount) {
        const num = Number(orderForm.fittedSheetCount);
        if (num < 0) {
          toast.error('Jumlah kasur dipasang sprei tidak boleh kurang dari 0');
          return;
        }
        if (num > totalMattressesInOrder) {
          toast.error(
            `Kasur dipasang sprei (${orderForm.fittedSheetCount}) tidak boleh melebihi total kasur (${totalMattressesInOrder})`
          );
          return;
        }
      }

      // 2. Cross-inventory stock validation (shared components across bundles and standalone items)
      if (crossDemandResult.hasConflict) {
        toast.error(crossDemandResult.conflicts[0].message);
        return;
      }

      const dueDateTime = orderForm.dueDateTime
        ? new Date(orderForm.dueDateTime)
        : endDateTime;

      // Structured logistics notes
      const notesLines: string[] = [];
      if (orderForm.notes?.trim()) {
        notesLines.push(orderForm.notes.trim());
      }
      if (orderForm.deliveryTime) {
        notesLines.push(`Jam antar: ${orderForm.deliveryTime}`);
      }
      if (orderForm.pickupTime) {
        notesLines.push(`Jam ambil: ${orderForm.pickupTime}`);
      }
      if (
        orderForm.upstairsMattressCount &&
        Number(orderForm.upstairsMattressCount) > 0
      ) {
        notesLines.push(
          `Kasur naik lantai atas: ${orderForm.upstairsMattressCount} unit`
        );
      }
      if (
        orderForm.fittedSheetCount &&
        Number(orderForm.fittedSheetCount) > 0
      ) {
        notesLines.push(
          `Kasur dipasang sprei: ${orderForm.fittedSheetCount} unit`
        );
      }
      if (orderForm.googleMapsUrl?.trim()) {
        notesLines.push(
          `Titik Google Maps: ${orderForm.googleMapsUrl.trim()}`
        );
      }
      if (
        orderForm.requiresDeposit &&
        Number(orderForm.depositAmount || 0) > 0
      ) {
        notesLines.push(
          `Deposit / Uang Jaminan: Rp ${Number(orderForm.depositAmount).toLocaleString('id-ID')}`
        );
      }
      const baseDeliveryFee = orderForm.deliveryFee
        ? Number(orderForm.deliveryFee)
        : 0;
      if (specialServicesTotalFee > 0 && baseDeliveryFee > 0) {
        notesLines.push(
          `Ongkos kirim dasar: Rp ${baseDeliveryFee.toLocaleString('id-ID')}`
        );
      }
      const finalNotes =
        notesLines.length > 0 ? notesLines.join('\n') : undefined;

      // Full address incorporating maps link
      const addressParts: string[] = [];
      if (orderForm.deliveryAddress?.trim()) {
        addressParts.push(orderForm.deliveryAddress.trim());
      }
      if (orderForm.googleMapsUrl?.trim()) {
        addressParts.push(`Maps: ${orderForm.googleMapsUrl.trim()}`);
      }
      const finalDeliveryAddress =
        addressParts.length > 0 ? addressParts.join('\n') : undefined;

      const parsedDeposit =
        orderForm.requiresDeposit && Number(orderForm.depositAmount || 0) > 0
          ? Number(orderForm.depositAmount)
          : undefined;

      const totalDeliveryFee =
        baseDeliveryFee + specialServicesTotalFee > 0
          ? baseDeliveryFee + specialServicesTotalFee
          : undefined;

      await apiAction(
        async () => {
          // If checked, save this new address to customer's address book
          if (
            orderForm.saveToCustomerAddresses &&
            orderForm.partnerId &&
            (orderForm.street || orderForm.deliveryAddress) &&
            !orderForm.selectedCustomerAddressId
          ) {
            try {
              await createAddressMutation.mutateAsync({
                partnerId: orderForm.partnerId,
                name: orderForm.addressName?.trim() || 'Alamat Pengantaran',
                isDefault: orderForm.saveAsDefaultAddress ?? false,
                address: finalDeliveryAddress,
                street: orderForm.street || undefined,
                kelurahan: orderForm.kelurahan || undefined,
                kecamatan: orderForm.kecamatan || undefined,
                kota: orderForm.kota || undefined,
                provinsi: orderForm.provinsi || undefined,
                zip: orderForm.zip || undefined,
                latitude: orderForm.latitude ?? undefined,
                longitude: orderForm.longitude ?? undefined,
              });
              utils.partner.listAddresses.invalidate({
                partnerId: orderForm.partnerId,
              });
            } catch (err) {
              console.warn(
                'Gagal menyimpan alamat ke buku alamat customer:',
                err
              );
            }
          }

          const payload = {
            partnerId: orderForm.partnerId,
            rentalStartDate: startDateTime.toISOString(),
            rentalEndDate: endDateTime.toISOString(),
            dueDateTime: dueDateTime.toISOString(),
            notes: finalNotes,
            deliveryFee: totalDeliveryFee,
            discountAmount:
              totalDiscountAmount > 0 ? totalDiscountAmount : undefined,
            discountLabel:
              computedDiscounts.length > 0
                ? computedDiscounts
                    .map(
                      (d) =>
                        `${d.label} (-Rp ${Number(d.amount).toLocaleString('id-ID')})`
                    )
                    .join(', ')
                : orderForm.discountAmount
                ? 'Diskon'
                : undefined,
            discounts:
              computedDiscounts.length > 0 ? computedDiscounts : undefined,
            deliveryAddress: finalDeliveryAddress,
            street: orderForm.street || undefined,
            kelurahan: orderForm.kelurahan || undefined,
            kecamatan: orderForm.kecamatan || undefined,
            kota: orderForm.kota || undefined,
            provinsi: orderForm.provinsi || undefined,
            zip: orderForm.zip || undefined,
            latitude: orderForm.latitude ?? undefined,
            longitude: orderForm.longitude ?? undefined,
            depositAmount: parsedDeposit,
            items: orderForm.items
              .filter(
                (i) =>
                  (i.rentalItemId || i.rentalBundleId) &&
                  (i.quantity === '' || (Number(i.quantity) || 0) > 0)
              )
              .map((i) => ({
                rentalItemId:
                  i.type === 'item' ? i.rentalItemId : undefined,
                rentalBundleId:
                  i.type === 'bundle' ? i.rentalBundleId : undefined,
                quantity: Number(i.quantity) || 1,
                pricePerDay: i.pricePerDay || undefined,
              })),
          };

          if (editingOrder?.id) {
            return updateMutation.mutateAsync({
              orderId: editingOrder.id,
              data: payload,
            });
          }

          return createMutation.mutateAsync(payload);
        },
        editingOrder?.id
          ? 'Order draft berhasil diperbarui'
          : 'Order draft berhasil dibuat'
      );
    },
    [
      orderForm,
      createMutation,
      updateMutation,
      createAddressMutation,
      utils.partner.listAddresses,
      getAvailableUnits,
      rentalItems,
      totalMattressesInOrder,
      crossDemandResult,
      specialServicesTotalFee,
      editingOrder,
      totalDiscountAmount,
      computedDiscounts,
    ]
  );

  const handleQuickCreateSuccess = useCallback(
    (customer: {
      id: string;
      name: string;
      phone?: string | null;
      address?: string | null;
    }) => {
      setCreatedCustomers((prev) => [customer, ...prev]);
      setOrderForm((prev) => {
        const custAddress = customer.address?.trim() || '';
        const shouldAutofill =
          !prev.deliveryAddress.trim() && Boolean(custAddress);

        return {
          ...prev,
          partnerId: customer.id,
          deliveryAddress: shouldAutofill
            ? custAddress
            : prev.deliveryAddress,
        };
      });
      setIsQuickCreateOpen(false);
    },
    []
  );

  return {
    // Data
    rentalItems,
    rentalBundles,
    customers,
    partnerAddresses,
    isLoadingData,
    rentalDays,
    subtotal,
    depositRequired,

    // Derived inventory pooling & services
    totalMattressesInOrder,
    stockConflicts,
    hasStockError,
    getDynamicRemainingForLine,
    upstairsFeePerUnit,
    fittedSheetFeePerUnit,
    upstairsTotalFee,
    fittedSheetTotalFee,
    specialServicesTotalFee,

    // Multiple Discounts
    computedDiscounts,
    totalDiscountAmount,
    addDiscount,
    removeDiscount,
    updateDiscount,
    applyPresetDiscount,

    // Form state
    orderForm,
    updateFormField,
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    isDirty,
    isEditing: Boolean(editingOrder?.id),

    // Mutation state
    isCreating: createMutation.isPending || updateMutation.isPending,
    isUpdating: updateMutation.isPending,

    // Handlers
    handleClose,
    handleSubmit,
    addItem,
    updateItem,
    updateItemType,
    updateItemUnified,
    updateItemQuantity,
    applyLocationData,
    selectSavedAddress,
    removeItem,
    getAvailableUnits,
    getBundleAvailableUnits,
    handleQuickCreateSuccess,
  };
}
