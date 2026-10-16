"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appConfig } from "@/lib/config";

/** Per-device preferences (owner's phone vs. counter tablet can differ). */
interface SettingsState {
  storeName: string;
  showCostPrice: boolean;
  setStoreName: (name: string) => void;
  setShowCostPrice: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: appConfig.storeName,
      showCostPrice: true,
      setStoreName: (storeName) => set({ storeName: storeName.trim() || appConfig.storeName }),
      setShowCostPrice: (showCostPrice) => set({ showCostPrice }),
    }),
    {
      name: "pa-settings",
      storage: createJSONStorage(() => localStorage),
      // Rehydrated in <StoreHydrator/> after mount to avoid SSR mismatches.
      skipHydration: true,
      partialize: (s) => ({ storeName: s.storeName, showCostPrice: s.showCostPrice }),
    },
  ),
);
