import { useState, type ReactElement, type ReactNode } from "react";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import { TrashIcon } from "../../../components/icons";
import { t } from "../../../copy";

export interface DetailsActionsProps {
  canClear: boolean;
  onClear: () => void;
  deleteAction?: ReactNode;
  onDelete?: () => void;
  isScreen: boolean;
}

/** Clear (asks first, then the Undo toast) and Delete at the bottom of task details. */
export function DetailsActions({
  canClear,
  onClear,
  deleteAction,
  onDelete,
  isScreen,
}: DetailsActionsProps): ReactElement {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-auto flex items-center gap-3 pt-4">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={!canClear}
        aria-disabled={!canClear ? "true" : undefined}
        onClick={() => setConfirming(true)}
        className="flex-1"
      >
        {t("common.clear")}
      </Button>
      {deleteAction ?? (
        <Button
          variant="destructive"
          fullWidth
          disabled={!onDelete}
          aria-disabled={!onDelete ? "true" : undefined}
          onClick={onDelete}
          className="flex-1 gap-2"
        >
          <TrashIcon size={16} />
          <span>{isScreen ? t("task.delete") : t("common.delete")}</span>
        </Button>
      )}
      <Dialog
        open={confirming}
        history={false}
        title={t("task.clear_title")}
        description={t("task.clear_body")}
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                onClear();
              }}
            >
              {t("common.clear")}
            </Button>
            <Button onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
          </>
        }
      />
    </div>
  );
}
