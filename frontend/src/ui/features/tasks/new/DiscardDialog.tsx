import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import { t } from "../../../copy";
import type { DiscardDialogProps } from "./types";

export function DiscardDialog({
  open,
  onDiscard,
  onKeepEditing,
}: DiscardDialogProps): ReactElement | null {
  return (
    <Dialog
      open={open}
      history={false}
      title={t("common.discard")}
      onClose={onKeepEditing}
      actions={
        <>
          <Button variant="destructive" onClick={onDiscard}>
            {t("common.discard_action")}
          </Button>
          <Button onClick={onKeepEditing}>{t("common.keep_editing")}</Button>
        </>
      }
    />
  );
}
