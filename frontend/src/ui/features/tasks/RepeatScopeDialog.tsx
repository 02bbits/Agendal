import { useRef } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import type { DeleteScope } from "../../domain/api";

export interface RepeatScopeDialogProps {
  open: boolean;
  onChoose: (scope: DeleteScope) => void;
  onCancel: () => void;
}

/** "Delete a repeating task": This task only / This and all future / Cancel. Focus starts on Cancel (A11Y-42). */
export function RepeatScopeDialog({
  open,
  onChoose,
  onCancel,
}: RepeatScopeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      title={t("task.repeat_scope_title")}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button variant="destructive" onClick={() => onChoose("one")}>
            {t("task.repeat_this")}
          </Button>
          <Button variant="destructive" onClick={() => onChoose("future")}>
            {t("task.repeat_future")}
          </Button>
          <Button ref={cancelRef} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </>
      }
    />
  );
}
