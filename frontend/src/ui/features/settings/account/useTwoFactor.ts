import { useRef, useState } from "react";
import { api } from "../../../../lib/api";
import { t } from "../../../copy";
import { formatWait } from "../../auth/CodeEntry";

/** Seconds to wait when a locked-out answer doesn't say how long. */
const DEFAULT_RETRY_AFTER_S = 60;

interface ErrorBody {
  error?: {
    retry_after?: number | string;
    message?: string;
    fields?: { current_password?: string[] };
  };
  errors?: { current_password?: string[] };
  message?: string;
}

/** The message for a refused "turn off" (wrong password, or too many tries). */
function turnOffError(status: number, body: ErrorBody | null): string {
  if (status === 429) {
    const wait = Number(body?.error?.retry_after) || DEFAULT_RETRY_AFTER_S;
    return t("auth.current_password_locked", { time: formatWait(wait) });
  }
  return (
    body?.error?.fields?.current_password?.[0] ??
    body?.errors?.current_password?.[0] ??
    body?.error?.message ??
    body?.message ??
    t("auth.current_password_wrong")
  );
}

function postTwoFactor(body: { enabled: boolean; current_password?: string }) {
  return api("/auth/two-factor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Two-step verification in Settings: turning it on saves at once; turning it off asks for the
 * current password in a dialog first. It follows the account the app holds (from `GET /me`), so
 * opening Settings asks the server nothing.
 */
export function useTwoFactor({
  enabled: enabledProp,
  onChange,
  showToast,
}: {
  enabled?: boolean;
  onChange?: (enabled: boolean) => void;
  showToast?: (message: string) => void;
}) {
  const [prevEnabledProp, setPrevEnabledProp] = useState(enabledProp);
  const [enabled, setEnabled] = useState(enabledProp ?? false);
  if (enabledProp !== prevEnabledProp) {
    setPrevEnabledProp(enabledProp);
    if (enabledProp !== undefined) setEnabled(enabledProp);
  }
  const [busy, setBusy] = useState(false);
  const [offOpen, setOffOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [offError, setOffError] = useState<string | null>(null);
  const [offBusy, setOffBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const saved = (next: boolean) => {
    setEnabled(next);
    onChange?.(next);
    showToast?.(
      t(
        next ? "settings.two_factor_on_toast" : "settings.two_factor_off_toast",
      ),
    );
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      const res = await postTwoFactor({ enabled: true });
      if (res.ok) saved(true);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const toggle = (next: boolean) => {
    if (busy) return;
    if (next) {
      turnOn();
      return;
    }
    setPassword("");
    setOffError(null);
    setOffOpen(true);
  };

  const confirmOff = async () => {
    if (offBusy) return;
    setOffBusy(true);
    setOffError(null);
    try {
      const res = await postTwoFactor({
        enabled: false,
        current_password: password,
      });
      if (res.ok) {
        setOffOpen(false);
        saved(false);
        return;
      }
      const body = await res.json().catch(() => null);
      setOffError(turnOffError(res.status, body));
      passwordRef.current?.focus();
    } catch {
      setOffError(t("error.generic"));
    } finally {
      setOffBusy(false);
    }
  };

  const changePassword = (value: string) => {
    setPassword(value);
    setOffError(null);
  };

  const cancelOff = () => {
    if (!offBusy) setOffOpen(false);
  };

  return {
    enabled,
    busy,
    toggle,
    passwordRef,
    offDialog: {
      open: offOpen,
      busy: offBusy,
      password,
      error: offError,
      changePassword,
      confirm: confirmOff,
      cancel: cancelOff,
    },
  };
}

export type TwoFactorOffDialogState = ReturnType<
  typeof useTwoFactor
>["offDialog"];
