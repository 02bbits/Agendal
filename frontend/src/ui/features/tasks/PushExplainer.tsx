import { useRef, type ReactElement } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { t } from "../../copy";

export interface PushExplainerProps {
  dialog: null | "ask" | "install";
  onAllow: () => void;
  onNotNow: () => void;
}

export function PushExplainer({
  dialog,
  onAllow,
  onNotNow,
}: PushExplainerProps): ReactElement | null {
  const notNowRef = useRef<HTMLButtonElement>(null);

  if (!dialog) {
    return null;
  }

  const isInstall = dialog === "install";
  const title = isInstall
    ? t("app.install_for_reminders")
    : t("task.push_explainer");

  return (
    <Dialog
      open={true}
      initialFocusRef={notNowRef}
      title={title}
      onClose={onNotNow}
      actions={
        <>
          {!isInstall && (
            <Button
              variant="primary"
              fullWidth
              className="rounded-2xl! py-3.5 text-base font-semibold"
              onClick={onAllow}
            >
              {t("common.allow")}
            </Button>
          )}
          <Button
            ref={notNowRef}
            variant="outline"
            fullWidth
            className="rounded-2xl! py-3.5 text-base font-semibold"
            onClick={onNotNow}
          >
            {t("common.not_now")}
          </Button>
        </>
      }
    />
  );
}
