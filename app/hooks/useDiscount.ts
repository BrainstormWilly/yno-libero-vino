import { useState, useCallback } from "react";
import type { Discount, PlatformType } from "~/types/discount";
import { createDefaultDiscount } from "~/types/discount";

/**
 * Hook for managing discount state
 */
export function useDiscount(platform: PlatformType, initialDiscount?: Discount) {
  const [discount, setDiscount] = useState<Discount>(
    initialDiscount || createDefaultDiscount(platform)
  );

  const updateDiscount = useCallback((updatedDiscount: Discount) => {
    setDiscount(updatedDiscount);
  }, []);

  const resetDiscount = useCallback(() => {
    setDiscount(createDefaultDiscount(platform));
  }, [platform]);

  const updateField = useCallback(<K extends keyof Discount>(
    field: K,
    value: Discount[K]
  ) => {
    setDiscount((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  return {
    discount,
    setDiscount: updateDiscount,
    resetDiscount,
    updateField,
  };
}

