import { useEffect, useRef, useState } from "react";
import {
  askForPush,
  pushSnoozed,
  pushState,
  renewPush,
  snoozePush,
} from "../../../lib/push";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { t } from "../../copy";
import { REMINDER_SET } from "../../domain/appEvents";
import { notifyPushState } from "./usePushState";

/**
 * Asks for notifications in context (TK §2.5, #186): the first time a reminder is set, by hand
 * or by a note, never at sign-in. Allow opens the browser's prompt; Not now waits 14 days. On an
 * iPhone in Safari it says to install the app, where push works. Signed in, a device that
 * already allowed it subscribes again quietly.
 */
export function PushPrompt({ signedIn }: { signedIn: boolean }) {
  const [asking, setAsking] = useState<"ask" | "install" | null>(null);
  const notNow = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (signedIn) void renewPush();
  }, [signedIn]);

  useEffect(() => {
    const onReminder = () => {
      const state = pushState();
      if ((state === "ask" || state === "install") && !pushSnoozed())
        setAsking(state);
    };
    window.addEventListener(REMINDER_SET, onReminder);
    return () => window.removeEventListener(REMINDER_SET, onReminder);
  }, []);

  const later = () => {
    snoozePush();
    setAsking(null);
  };
  const allow = async () => {
    setAsking(null);
    await askForPush().catch(() => "default");
    notifyPushState();
  };

  return (
    <Dialog
      open={asking !== null}
      title={
        asking === "install"
          ? t("app.install_for_reminders")
          : t("task.push_explainer")
      }
      description={asking === "install" ? t("app.install_ios") : undefined}
      onClose={later}
      initialFocusRef={notNow}
      actionsLayout="row"
      actions={
        <>
          <Button ref={notNow} onClick={later}>
            {t("common.not_now")}
          </Button>
          {asking === "ask" && (
            <Button variant="primary" onClick={() => void allow()}>
              {t("common.allow")}
            </Button>
          )}
        </>
      }
    />
  );
}
