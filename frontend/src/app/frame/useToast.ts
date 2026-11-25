import { useCallback, useRef, useState } from "react";
import { MAX_TOASTS, type ToastData } from "@/ui/components/Toast";

export type ShowToast = (
  messageOrDraft: string | Omit<ToastData, "id">,
) => void;

/**
 * The app's toasts (#168): up to three at once, so quick actions one after another each keep
 * their toast and its Undo; a fourth drops the oldest. They survive navigation (UX-04).
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const lastId = useRef(0);

  const showToast = useCallback<ShowToast>((messageOrDraft) => {
    const id = ++lastId.current;
    const toast =
      typeof messageOrDraft === "string"
        ? { id, message: messageOrDraft }
        : { ...messageOrDraft, id };
    setToasts((current) => [...current, toast].slice(-MAX_TOASTS));
  }, []);

  const dismissToast = useCallback(
    (id: ToastData["id"]) =>
      setToasts((current) => current.filter((toast) => toast.id !== id)),
    [],
  );

  return { toasts, showToast, dismissToast };
}
