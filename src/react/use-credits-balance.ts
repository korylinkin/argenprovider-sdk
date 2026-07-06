"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBalance } from "./api.js";
import type { Balance } from "../core/types.js";

export interface UseCreditsBalanceOptions {
  basePath?: string;
}

export interface UseCreditsBalanceResult {
  balance: Balance | null;
  loading: boolean;
  refresh(): Promise<void>;
}

export function useCreditsBalance(opts: UseCreditsBalanceOptions = {}): UseCreditsBalanceResult {
  const basePath = opts.basePath ?? "/api/credits";
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchBalance(basePath);
      if (!("error" in data)) setBalance(data);
    } catch {
      // red: mantenemos el último valor conocido
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
