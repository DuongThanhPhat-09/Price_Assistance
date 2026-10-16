"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Counts in-app navigations so the on-screen Back button knows whether
 * `history.back()` stays inside the app or would leave it (e.g. the page
 * was opened from a bookmark). In that case Back goes Home instead.
 */
let inAppNavigations = 0;

export function hasInAppHistory() {
  return inAppNavigations > 0;
}

export function NavigationTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    inAppNavigations++;
  }, [pathname]);
  return null;
}
