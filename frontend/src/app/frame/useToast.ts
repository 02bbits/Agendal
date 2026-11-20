import { useCallback, useState } from "react";
import type { ToastData } from "@/ui";

export type ShowToast = (
  messageOrDraft: string | Omit<ToastData, "id">,
) => void;

/** One app-wide toast; a new one replaces the last. It survives navigation (UX-04). */
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback<ShowToast>(
    (messageOrDraft) =>
      setToast((current) => {
        const id = typeof current?.id === "number" ? current.id + 1 : 1;
        return typeof messageOrDraft === "string"
          ? { id, message: messageOrDraft }
          : { ...messageOrDraft, id };
      }),
    [],
  );

  const dismissToast = useCallback(
    (id: ToastData["id"]) =>
      setToast((current) => (current?.id === id ? null : current)),
    [],
  );

  return { toast, showToast, dismissToast };
}
