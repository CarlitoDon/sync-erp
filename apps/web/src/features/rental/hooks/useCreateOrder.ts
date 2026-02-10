import React, { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { UnitStatus, PartnerType } from '@sync-erp/shared';
import { useRentalPricing, useRentalDays } from './useRentalPricing';

interface OrderItem {
  type: 'item' | 'bundle';
  rentalItemId?: string;
  rentalBundleId?: string;
  quantity: number;
}

export type { OrderItem };

interface UseCreateOrderParams {
  isOpen: boolean;
  onSuccess?: () => void;
  onClose: () => void;
}

export function useCreateOrder({
  isOpen,
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
      { companyId: currentCompany?.id || '' },
      { enabled: isOpen && !!currentCompany?.id }
    );

  const isLoadingData = isLoadingItems || isLoadingPartners;

  // Form state
  const [orderForm, setOrderForm] = useState({
    partnerId: '',
    rentalStartDate: new Date().toISOString().split('T')[0],
    rentalEndDate: '',
    dueDateTime: '',
    notes: '',
    items: [] as OrderItem[],
  });
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

  // Mutation
  const createMutation = trpc.rental.orders.create.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      onSuccess?.();
      handleClose();
    },
  });

  // Derived
  const customers = useMemo(
    () => partners.filter((p) => p.type === PartnerType.CUSTOMER),
    [partners]
  );

  // Handlers
  const resetForm = useCallback(() => {
    setOrderForm({
      partnerId: '',
      rentalStartDate: new Date().toISOString().split('T')[0],
      rentalEndDate: '',
      dueDateTime: '',
      notes: '',
      items: [],
    });
  }, []);

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
      value: string | number | 'item' | 'bundle'
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

  const removeItem = useCallback((idx: number) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }, []);

  const getAvailableUnits = useCallback(
    (itemId: string) => {
      const item = rentalItems.find((ri) => ri.id === itemId);
      return (
        item?.units?.filter((u) => u.status === UnitStatus.AVAILABLE)
          .length || 0
      );
    },
    [rentalItems]
  );

  const updateFormField = useCallback(
    (field: string, value: string) => {
      setOrderForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (orderForm.items.length === 0) return;

      const dueDateTime = orderForm.dueDateTime
        ? new Date(orderForm.dueDateTime)
        : new Date(orderForm.rentalEndDate + 'T18:00:00');

      await apiAction(
        () =>
          createMutation.mutateAsync({
            partnerId: orderForm.partnerId,
            rentalStartDate: new Date(
              orderForm.rentalStartDate
            ).toISOString(),
            rentalEndDate: new Date(
              orderForm.rentalEndDate
            ).toISOString(),
            dueDateTime: dueDateTime.toISOString(),
            notes: orderForm.notes || undefined,
            items: orderForm.items
              .filter(
                (i) =>
                  (i.rentalItemId || i.rentalBundleId) &&
                  i.quantity > 0
              )
              .map((i) => ({
                rentalItemId:
                  i.type === 'item' ? i.rentalItemId : undefined,
                rentalBundleId:
                  i.type === 'bundle' ? i.rentalBundleId : undefined,
                quantity: i.quantity,
              })),
          }),
        'Order berhasil dibuat'
      );
    },
    [orderForm, createMutation]
  );

  const handleQuickCreateSuccess = useCallback(
    (partnerId: string) => {
      setOrderForm((prev) => ({ ...prev, partnerId }));
      setIsQuickCreateOpen(false);
    },
    []
  );

  return {
    // Data
    rentalItems,
    rentalBundles,
    customers,
    isLoadingData,
    rentalDays,
    subtotal,
    depositRequired,

    // Form state
    orderForm,
    updateFormField,
    isQuickCreateOpen,
    setIsQuickCreateOpen,

    // Mutation state
    isCreating: createMutation.isPending,

    // Handlers
    handleClose,
    handleSubmit,
    addItem,
    updateItem,
    updateItemType,
    removeItem,
    getAvailableUnits,
    handleQuickCreateSuccess,
  };
}
