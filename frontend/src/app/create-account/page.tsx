"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { timeZone } from "@/lib/clock";
import { CreateAccountScreen, ROUTES, t, type SignUpFailure } from "@/ui";
import { useAppFrame } from "../AppFrame";

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/** Create account (IM-11): POST /auth/register, then Inbox with the welcome toast. */
export default function CreateAccountPage() {
  const { navigate, showToast } = useAppFrame();
  const offline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false,
  );

  async function register(values: {
    email: string;
    password: string;
  }): Promise<SignUpFailure | void> {
    let response: Response;
    try {
      response = await api("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, timezone: timeZone() }),
      });
    } catch {
      return { form: t("auth.offline") };
    }

    if (response.ok) {
      showToast(t("auth.welcome"));
      navigate(ROUTES.inbox);
      return;
    }
    if (response.status === 429) {
      const seconds = response.headers.get("Retry-After") ?? "60";
      return { form: t("error.rate_limited", { seconds }) };
    }
    const body = await response.json().catch(() => null);
    if (response.status === 422 && body?.error?.fields) {
      const fields = body.error.fields as Record<string, string[]>;
      return {
        fields: { email: fields.email?.[0], password: fields.password?.[0] },
      };
    }
    return {
      form: t("error.generic", { request_id: body?.error?.request_id ?? "" }),
    };
  }

  return (
    <CreateAccountScreen
      onSubmit={register}
      signInHref={ROUTES.signIn}
      navigate={navigate}
      offline={offline}
    />
  );
}
