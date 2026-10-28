import { useRef, useState } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { TrashIcon } from "../../components/icons";
import type { DeleteScope } from "../../domain/api";
import type { Task } from "../../domain/types";
import { RepeatScopeDialog } from "./RepeatScopeDialog";
import { useTaskStore } from "./store";

export interface DeleteTaskProps {
  task: Task;
  /** After deleting from details, the screen goes back (TK §2.4). */
  onDeleted?: () => void;
}

/** "Delete task" with a confirmation, or the scope dialog for a repeating task (TK-4, TK-5). */
export function DeleteTask({ task, onDeleted }: DeleteTaskProps) {
  const store = useTaskStore();
  const [asking, setAsking] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const repeating = task.repeat !== "never";

  const confirm = (scope?: DeleteScope) => {
    setAsking(false);
    store.remove(task, scope);
    onDeleted?.();
  };

  return (
    <>
      <Button variant="destructive" fullWidth onClick={() => setAsking(true)}>
        <TrashIcon size={18} />
        {t("task.delete")}
      </Button>
      {repeating ? (
        <RepeatScopeDialog
          open={asking}
          onChoose={confirm}
          onCancel={() => setAsking(false)}
        />
      ) : (
        <Dialog
          open={asking}
          title={t("task.delete_title", { title: task.title })}
          onClose={() => setAsking(false)}
          initialFocusRef={cancelRef}
          actions={
            <>
              <Button variant="destructive" onClick={() => confirm()}>
                {t("common.delete")}
              </Button>
              <Button ref={cancelRef} onClick={() => setAsking(false)}>
                {t("common.cancel")}
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
