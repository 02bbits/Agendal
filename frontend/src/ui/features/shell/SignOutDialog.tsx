import { useRef, useState, type ReactElement } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { DialogCheckbox } from "../../components/DialogCheckbox";
import { t } from "../../copy";

const ACTION = "rounded-2xl! py-3.5 text-base font-semibold";

/**
 * Sign out asks first (#168), from the account menu and Settings alike: Cancel or Sign out, with
 * a Sign out on all devices checkbox while the app offers it. Cancel has the focus, so Enter never
 * signs out by mistake; Escape, a tap outside and Back close it too.
 */
export function SignOutDialog({
  open,
  onSignOut,
  onSignOutEverywhere,
  onClose,
}: {
  open: boolean;
  onSignOut: () => void;
  onSignOutEverywhere?: () => void;
  onClose: () => void;
}): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [everywhere, setEverywhere] = useState(false);
  // Each time it opens it starts unticked
  const close = () => {
    setEverywhere(false);
    onClose();
  };
  const confirm = () => {
    close();
    if (everywhere && onSignOutEverywhere) onSignOutEverywhere();
    else onSignOut();
  };

  return (
    <Dialog
      open={open}
      title={t("app.sign_out_title")}
      description={t(
        everywhere ? "app.sign_out_all_body" : "app.sign_out_body",
      )}
      onClose={close}
      initialFocusRef={cancelRef}
      actionsLayout="row"
      actions={
        <>
          <Button
            ref={cancelRef}
            variant="outline"
            fullWidth
            className={ACTION}
            onClick={close}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            fullWidth
            className={ACTION}
            onClick={confirm}
          >
            {t("app.sign_out")}
          </Button>
        </>
      }
    >
      {onSignOutEverywhere && (
        <DialogCheckbox
          label={t("auth.signout_everywhere")}
          checked={everywhere}
          onChange={setEverywhere}
        />
      )}
    </Dialog>
  );
}
