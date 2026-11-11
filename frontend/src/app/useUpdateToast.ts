"use client";

import { useEffect, useRef } from "react";
import { t } from "@/ui";
import type { ToastData } from "@/ui/components/Toast";
import { activateUpdate, registerServiceWorker } from "@/lib/serviceWorker";

const MODAL = '[aria-modal="true"]';
const RECHECK_MS = 1000;

// UX-42: offers "A new version is ready." once a new service worker waits. Never reloads by
// itself; an ignored toast is applied on the next cold start (the waiting worker takes over
// when every tab is closed). AP-E5: the toast holds back while a sheet or dialog is open.
export function useUpdateToast(
  showToast: (toast: Omit<ToastData, "id">) => void,
) {
  const show = useRef(showToast);
  useEffect(() => {
    show.current = showToast;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    registerServiceWorker((worker) => {
      const offer = () => {
        // ponytail: polls for an open modal; swap for a modal-state signal if one appears
        if (document.querySelector(MODAL)) {
          timer = setTimeout(offer, RECHECK_MS);
          return;
        }
        show.current({
          message: t("app.update_ready"),
          actionLabel: t("app.reload"),
          onAction: () => activateUpdate(worker),
        });
      };
      offer();
    });
    return () => clearTimeout(timer);
  }, []);
}
