import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import { t } from "../../../copy";
import type { DiscardDialogProps } from "./types";

export function DiscardDialog({
  open,
  title = t("common.discard"),
  description,
  onDiscard,
  onKeepEditing,
}: DiscardDialogProps): ReactElement | null {
  return (
    <Dialog
      open={open}
      history={false}
      title={title}
      description={description}
      onClose={onKeepEditing}
      actionsLayout="row"
      actions={
        <>
          <Button onClick={onKeepEditing}>{t("common.keep_editing")}</Button>
          <Button variant="destructive" onClick={onDiscard}>
            {t("common.discard_action")}
          </Button>
        </>
      }
    />
  );
}
