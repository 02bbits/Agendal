import type { ReactElement } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { t } from "../../copy";

/**
 * Undo all, or Edit note on an applied note, would remove tasks edited by hand since: ask first (RV-E1, RV-E16).
 * Open while `count` is above 0.
 */
export function UndoConflictDialog({
  count,
  onConfirm,
  onCancel,
  history,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  /** Off when it opens over a screen that has its own history entry (the note editor). */
  history?: boolean;
}): ReactElement | null {
  return (
    <Dialog
      open={count > 0}
      history={history}
      title={t("note.undo_conflict_title")}
      description={t("note.undo_conflict_body", { count })}
      onClose={onCancel}
      actions={
        <>
          <Button variant="destructive" onClick={onConfirm}>
            {t("note.undo_all")}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </>
      }
    />
  );
}
