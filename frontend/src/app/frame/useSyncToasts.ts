import { useEffect } from "react";
import { t } from "@/ui";
import { CONFLICT } from "@/lib/conflicts";
import { backOnlineText } from "@/lib/noteApi";
import { NOTES_REPLAYED, startSync, type Replayed } from "@/lib/sync";
import type { ShowToast } from "./useToast";

/**
 * Syncs while signed in (IM-52, ADR-005). A change lost in a conflict says so (AP-E7), and notes
 * sent after a reconnect say so (NC-6); only the latest toast shows.
 */
export function useSyncToasts(signedIn: boolean, showToast: ShowToast) {
  useEffect(() => (signedIn ? startSync() : undefined), [signedIn]);

  useEffect(() => {
    const onConflict = (event: Event) =>
      showToast(
        t("app.conflict", {
          title: (event as CustomEvent<{ title: string }>).detail.title,
        }),
      );
    const onReplayed = (event: Event) =>
      showToast(backOnlineText((event as CustomEvent<Replayed>).detail));
    window.addEventListener(CONFLICT, onConflict);
    window.addEventListener(NOTES_REPLAYED, onReplayed);
    return () => {
      window.removeEventListener(CONFLICT, onConflict);
      window.removeEventListener(NOTES_REPLAYED, onReplayed);
    };
  }, [showToast]);
}
