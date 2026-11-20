import { useRef, type ReactElement } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { t } from "../../copy";

const ACTION = "rounded-2xl! py-3.5 text-base font-semibold";

/**
 * Sign out asks first (#168), from the account menu and from Settings alike: Sign out, Sign out on
 * all devices while the app offers it, or Cancel. Cancel has the focus, so Enter never signs out
 * by mistake; Escape, a tap outside and Back close it too.
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
  const choose = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Dialog
      open={open}
      title={t("app.sign_out_title")}
      description={t("app.sign_out_body")}
      onClose={onClose}
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button
            variant="destructive"
            fullWidth
            className={ACTION}
            onClick={choose(onSignOut)}
          >
            {t("app.sign_out")}
          </Button>
          {onSignOutEverywhere && (
            <Button
              variant="secondary"
              fullWidth
              className={ACTION}
              onClick={choose(onSignOutEverywhere)}
            >
              {t("auth.signout_everywhere")}
            </Button>
          )}
          <Button
            ref={cancelRef}
            variant="outline"
            fullWidth
            className={ACTION}
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
        </>
      }
    />
  );
}
