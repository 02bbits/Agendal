"use client";

import { api } from "@/lib/api";
import {
  VerifyEmailScreen,
  t,
  type ResendResult,
  type VerifyResult,
} from "@/ui";
import { useAppFrame } from "../AppFrame";

export default function VerifyPage() {
  const { navigate, user, setUser, signOut } = useAppFrame();

  const handleVerify = async (code: string): Promise<VerifyResult> => {
    try {
      const response = await api("/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const body = await response.json().catch(() => null);

      if (response.ok) {
        if (body?.user) {
          setUser(body.user);
        }
        return { ok: true, user: body?.user };
      }

      if (response.status === 429) {
        const retryAfter =
          Number(body?.error?.retry_after) ||
          Number(response.headers.get("Retry-After")) ||
          60;
        return { ok: false, status: 429, retryAfter };
      }

      const errorMessage =
        body?.error?.fields?.code?.[0] ??
        body?.error?.message ??
        t("auth.verify_wrong");

      return {
        ok: false,
        status: response.status,
        code: body?.error?.code,
        message: errorMessage,
      };
    } catch {
      return {
        ok: false,
        status: 500,
        message: t("error.generic"),
      };
    }
  };

  const handleResend = async (): Promise<ResendResult> => {
    try {
      const response = await api("/auth/verify-email/resend", {
        method: "POST",
      });

      if (response.ok) {
        return { ok: true };
      }

      const body = await response.json().catch(() => null);
      const retryAfter =
        Number(body?.error?.retry_after) ||
        Number(response.headers.get("Retry-After")) ||
        45;

      return {
        ok: false,
        status: response.status,
        retryAfter,
        message:
          response.status === 429
            ? t("error.rate_limited", { seconds: retryAfter })
            : (body?.error?.message ??
              t("error.rate_limited", { seconds: retryAfter })),
      };
    } catch {
      return {
        ok: false,
        status: 500,
        message: t("error.generic"),
      };
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
  };

  return (
    <VerifyEmailScreen
      email={user?.email ?? ""}
      onVerify={handleVerify}
      onResend={handleResend}
      onSwitchAccount={handleSwitchAccount}
      navigate={navigate}
    />
  );
}
