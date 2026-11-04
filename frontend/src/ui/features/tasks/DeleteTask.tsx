import { useRef, useState, type ReactElement } from "react";
import { flushSync } from "react-dom";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { TrashIcon } from "../../components/icons";
import { t } from "../../copy";
import type { DeleteScope } from "../../domain/api";
import type { Task } from "../../domain/types";
import { RepeatScopeDialog } from "./RepeatScopeDialog";
import { useTaskStore } from "./store";

export interface DeleteTaskProps {
  task: Task;
  /** After deleting from details, the screen goes back or closes (TK §2.4). */
  onDeleted?: () => void;
  label?: string;
  isScreen?: boolean;
}

/** "Delete task" with a confirmation, or the scope dialog for a repeating task (TK-4, TK-5). */
export function DeleteTask({
  task,
  onDeleted,
  label,
  isScreen = false,
}: DeleteTaskProps): ReactElement {
  const store = useTaskStore();
  const [asking, setAsking] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const repeating = task.repeat !== "never";

  const confirm = (scope?: DeleteScope) => {
    // The dialog takes its history entry off in a timer; leaving queues behind it,
    // or Back would only remove that entry and stay on the deleted task
    flushSync(() => setAsking(false));
    store.remove(task, scope);
    setTimeout(() => onDeleted?.());
  };

  return (
    <>
      <Button
        variant="destructive"
        fullWidth
        onClick={() => setAsking(true)}
        className="flex-1 gap-2"
      >
        <TrashIcon size={16} />
        <span>{label ?? (isScreen ? t("task.delete") : t("task.delete"))}</span>
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
