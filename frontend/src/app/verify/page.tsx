"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  ROUTES,
  VerifyEmailScreen,
  t,
  type ResendResult,
  type VerifyResult,
} from "@/ui";
import { useAppFrame } from "../AppFrame";

export default function VerifyPage() {
  const { navigate, setUser } = useAppFrame();
  const [email, setEmail] = useState("");
  // navigate changes when the path does; reading it from a ref keeps the effect below to
  // one GET /auth/signup per visit. A second one sent with the pre-verify cookie could land
  // after the code is accepted, answer 404 and send the new account back to Create account.
  const navigateRef = useRef(navigate);
  const verified = useRef(false);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    let active = true;
    void api("/auth/signup")
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          const data = await response.json();
          if (active && data?.email) {
            setEmail(data.email);
          }
        } else if (response.status === 404 && !verified.current) {
          navigateRef.current(ROUTES.createAccount);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleVerify = async (code: string): Promise<VerifyResult> => {
    try {
      const response = await api("/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const body = await response.json().catch(() => null);

      if (response.ok) {
        verified.current = true;
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
      const response = await api("/auth/signup/resend", {
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

  const handleOther = (result: VerifyResult): boolean => {
    if (result.code === "auth.signup_expired") {
      navigate(ROUTES.createAccount);
      return true;
    }
    return false;
  };

  const handleSwitchAccount = async () => {
    try {
      await api("/auth/signup", { method: "DELETE" });
    } catch {
      // Ignore network errors when cancelling
    }
  };

  return (
    <VerifyEmailScreen
      email={email}
      onVerify={handleVerify}
      onResend={handleResend}
      onSwitchAccount={handleSwitchAccount}
      navigate={navigate}
      onOther={handleOther}
    />
  );
}
