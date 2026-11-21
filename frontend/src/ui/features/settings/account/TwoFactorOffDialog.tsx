import type { ReactElement, RefObject } from "react";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import { t } from "../../../copy";
import { PasswordField } from "../../auth/PasswordField";
import type { TwoFactorOffDialogState } from "./useTwoFactor";

/** Turning two-step verification off asks for the current password first. */
export function TwoFactorOffDialog({
  dialog,
  passwordRef,
}: {
  dialog: TwoFactorOffDialogState;
  passwordRef: RefObject<HTMLInputElement | null>;
}): ReactElement {
  return (
    <Dialog
      open={dialog.open}
      title={t("settings.two_factor_off_title")}
      onClose={dialog.cancel}
      initialFocusRef={passwordRef}
      history={false}
      actionsLayout="row"
      actions={
        <>
          <Button
            variant="secondary"
            disabled={dialog.busy}
            onClick={dialog.cancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={dialog.busy}
            onClick={dialog.confirm}
          >
            {t("settings.two_factor_off_confirm")}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          dialog.confirm();
        }}
        className="mt-2"
      >
        <PasswordField
          ref={passwordRef}
          label={t("settings.current_password")}
          autoComplete="current-password"
          value={dialog.password}
          onChange={(e) => dialog.changePassword(e.target.value)}
          error={dialog.error ?? undefined}
        />
      </form>
    </Dialog>
  );
}
