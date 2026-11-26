import { useRef, useState, type ReactElement } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { DialogCheckbox } from "../../components/DialogCheckbox";
import { t } from "../../copy";
import type { DeleteScope } from "../../domain/api";

export interface RepeatScopeDialogProps {
  open: boolean;
  onChoose: (scope: DeleteScope) => void;
  onCancel: () => void;
}

/** "Delete a repeating task" with a "Delete all repeating tasks" checkbox. Focus starts on Cancel (A11Y-42). */
export function RepeatScopeDialog({
  open,
  onChoose,
  onCancel,
}: RepeatScopeDialogProps): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const [deleteAll, setDeleteAll] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setDeleteAll(false);
  }

  return (
    <Dialog
      open={open}
      title={t("task.repeat_scope_title")}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      actionsLayout="row"
      actions={
        <>
          <Button ref={cancelRef} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onChoose(deleteAll ? "future" : "one")}
          >
            {t("common.delete")}
          </Button>
        </>
      }
    >
      <DialogCheckbox
        label={t("task.repeat_delete_all")}
        checked={deleteAll}
        onChange={setDeleteAll}
      />
    </Dialog>
  );
}
