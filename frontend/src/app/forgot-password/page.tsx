"use client";

import { api } from "@/lib/api";
import { useOffline } from "@/lib/online";
import { ForgotPasswordScreen, ROUTES, t } from "@/ui";
import { useAppFrame } from "../AppFrame";

/** Reset request (IM-13): POST /auth/forgot-password always answers 202. */
export default function ForgotPasswordPage() {
  const { navigate } = useAppFrame();
  const offline = useOffline();

  async function requestLink(email: string): Promise<string | void> {
    let response: Response;
    try {
      response = await api("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      return t("auth.offline");
    }
    if (response.ok) return;
    if (response.status === 429) {
      const seconds = response.headers.get("Retry-After") ?? "60";
      return t("error.rate_limited", { seconds });
    }
    const body = await response.json().catch(() => null);
    return t("error.generic", { request_id: body?.error?.request_id ?? "" });
  }

  return (
    <ForgotPasswordScreen
      onSubmit={requestLink}
      signInHref={ROUTES.signIn}
      navigate={navigate}
      offline={offline}
    />
  );
}
