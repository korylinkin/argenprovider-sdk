"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPurchases } from "./api.js";
import type { PurchaseList } from "../core/types.js";

export interface UsePurchasesOptions {
  basePath?: string;
  pageSize?: number;
}

export interface UsePurchasesResult {
  purchases: PurchaseList | null;
  page: number;
  setPage(page: number): void;
  loading: boolean;
  refresh(page?: number): Promise<void>;
}

export function usePurchases(opts: UsePurchasesOptions = {}): UsePurchasesResult {
  const basePath = opts.basePath ?? "/api/credits";
  const pageSize = opts.pageSize ?? 10;
  const [purchases, setPurchases] = useState<PurchaseList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (targetPage?: number) => {
      try {
        const data = await fetchPurchases(basePath, targetPage ?? page, pageSize);
        if (!("error" in data)) setPurchases(data);
      } catch {
        // red: mantenemos el último valor conocido
      } finally {
        setLoading(false);
      }
    },
    [basePath, page, pageSize]
  );

  useEffect(() => {
    refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, basePath, pageSize]);

  return { purchases, page, setPage, loading, refresh };
}
