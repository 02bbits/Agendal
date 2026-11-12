"use client";

import { useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { now } from "@/lib/clock";
import { useOffline } from "@/lib/online";
import {
  ROUTES,
  SignInScreen,
  safeReturnPath,
  t,
  type SignInResult,
} from "@/ui";
import { useAppFrame } from "../AppFrame";

// The lockout deadline survives a reload, so the countdown carries on (AA-E3, T-AA-103)
const LOCK_KEY = "agendal.sign_in_locked_until";

function readLock(): number | null {
  try {
    const until = Number(sessionStorage.getItem(LOCK_KEY));
    return until > now().getTime() ? until : null;
  } catch {
    return null;
  }
}

function saveLock(until: number) {
  try {
    sessionStorage.setItem(LOCK_KEY, String(until));
  } catch {
    // Private mode: the countdown just won't survive a reload
  }
}

const noSubscribe = () => () => {};

/** Sign in (IM-12): POST /auth/login, then the requested screen or Inbox. */
export default function SignInPage() {
  const { navigate, setUser } = useAppFrame();
  const offline = useOffline();
  const storedLock = useSyncExternalStore(noSubscribe, readLock, () => null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  async function signIn(values: {
    email: string;
    password: string;
    remember: boolean;
  }): Promise<SignInResult> {
    let response: Response;
    try {
      response = await api("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      return { form: t("auth.offline") };
    }

    if (response.status === 202) {
      const data = await response.json().catch(() => null);
      if (data?.two_factor) {
        return { twoFactor: true, email: data.email ?? "" };
      }
    }

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data?.user) {
        setUser(data.user);
      }
      if (data?.user?.email_verified_at === null) {
        navigate(ROUTES.verify);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      navigate(safeReturnPath(next));
      return;
    }
    const body = await response.json().catch(() => null);
    if (response.status === 429) {
      const seconds =
        Number(body?.error?.retry_after) ||
        Number(response.headers.get("Retry-After")) ||
        60;
      const until = now().getTime() + seconds * 1000;
      saveLock(until);
      setLockedUntil(until);
      return;
    }
    if (body?.error?.code === "auth.invalid") return { invalid: true };
    return {
      form: t("error.generic", { request_id: body?.error?.request_id ?? "" }),
    };
  }

  async function challengeTwoFactor(code: string) {
    try {
      const response = await api("/auth/two-factor/challenge", {
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
      return {
        ok: false,
        status: response.status,
        code: body?.error?.code,
        message:
          body?.error?.fields?.code?.[0] ??
          body?.error?.message ??
          t("auth.verify_wrong"),
      };
    } catch {
      return { ok: false, status: 500, message: t("error.generic") };
    }
  }

  async function resendTwoFactor() {
    try {
      const response = await api("/auth/two-factor/resend", {
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
        code: body?.error?.code,
        retryAfter,
        message:
          body?.error?.message ??
          t("error.rate_limited", { seconds: retryAfter }),
      };
    } catch {
      return { ok: false, status: 500, message: t("error.generic") };
    }
  }

  function handleTwoFactorSuccess(user: unknown) {
    const userObj = user as { email_verified_at?: string | null } | null;
    if (userObj?.email_verified_at === null) {
      navigate(ROUTES.verify);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    navigate(safeReturnPath(next));
  }

  return (
    <SignInScreen
      onSubmit={signIn}
      onTwoFactorChallenge={challengeTwoFactor}
      onTwoFactorResend={resendTwoFactor}
      onTwoFactorSuccess={handleTwoFactorSuccess}
      lockedUntil={lockedUntil ?? storedLock}
      forgotPasswordHref={ROUTES.forgotPassword}
      createAccountHref={ROUTES.createAccount}
      navigate={navigate}
      offline={offline}
    />
  );
}
