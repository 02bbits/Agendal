import { useCallback } from "react";
import { t } from "../../copy";
import { placeAt, type OrderField } from "../../domain/order";
import type { Task } from "../../domain/types";
import { useTaskStore } from "../tasks/store";
import { useSortMode, type SortList } from "./useSortMode";

/**
 * A row dropped elsewhere in its own list (#178): writes its place, usually one key. In smart
 * mode the drop switches the list to manual order, with "Switched to manual order · Undo".
 */
export function useDropReorder(
  list: SortList,
  field: OrderField,
): (shown: readonly Task[], id: string, to: number) => void {
  const { reorder, showToast } = useTaskStore();
  const [mode, setMode] = useSortMode(list);
  return useCallback(
    (shown, id, to) => {
      const undo = reorder(placeAt(shown, id, to, field), field);
      if (mode === "manual") return;
      setMode("manual");
      showToast({
        message: t("list.switched_manual"),
        actionLabel: t("common.undo"),
        onAction: () => {
          undo();
          setMode("smart");
        },
      });
    },
    [field, mode, reorder, setMode, showToast],
  );
}
