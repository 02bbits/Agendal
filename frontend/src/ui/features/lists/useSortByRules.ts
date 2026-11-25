import { useCallback } from "react";
import { t } from "../../copy";
import { rulesKeys, type OrderField } from "../../domain/order";
import type { Task } from "../../domain/types";
import { useTaskStore } from "../tasks/store";
import { useSortMode, type SortList } from "./useSortMode";

/**
 * Sort by rules (Spec 02 §2.1): places the list once in its rule order and keeps it manual, so
 * the user can drag the exceptions. The toast's Undo puts the old places and mode back.
 */
export function useSortByRules(
  list: SortList,
  field: OrderField,
): (inRuleOrder: readonly Task[]) => void {
  const { reorder, showToast } = useTaskStore();
  const [mode, setMode] = useSortMode(list);
  return useCallback(
    (inRuleOrder) => {
      if (inRuleOrder.length === 0) return;
      const previous = mode;
      const undo = reorder(rulesKeys(inRuleOrder), field);
      setMode("manual");
      showToast({
        message: t("list.sorted_by_rules"),
        actionLabel: t("common.undo"),
        onAction: () => {
          undo();
          setMode(previous);
        },
      });
    },
    [field, mode, reorder, setMode, showToast],
  );
}
