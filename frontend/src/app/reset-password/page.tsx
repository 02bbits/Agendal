"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { useOffline } from "@/lib/online";
import { ResetPasswordScreen, ROUTES, t, type ResetFailure } from "@/ui";
import { useAppFrame } from "../AppFrame";

type Link = { token: string; email: string } | null;

// The link is /reset-password#token=…&email=…. The fragment never reaches a server log or a
// Referer (AA §2.3). It's read once and kept, so it survives being removed from the address bar.
let lastLink: { hash: string; link: Link } | null = null;

function readLink(): Link {
  const hash = window.location.hash;
  if (hash && hash !== lastLink?.hash) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");
    const email = params.get("email");
    lastLink = { hash, link: token && email ? { token, email } : null };
  }
  return lastLink?.link ?? null;
}

const noSubscribe = () => () => {};

/** Set a new password (IM-13): POST /auth/reset-password, then Inbox with a toast. */
export default function ResetPasswordPage() {
  const { navigate, showToast } = useAppFrame();
  const offline = useOffline();
  // undefined while prerendering: the fragment exists only in the browser
  const link = useSyncExternalStore(noSubscribe, readLink, () => undefined);

  // Take the token out of the address bar, so it isn't left in history or shared by copying the URL
  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
  }, []);

  async function reset(password: string): Promise<ResetFailure | void> {
    if (!link) return { expired: true };
    let response: Response;
    try {
      response = await api("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...link, password }),
      });
    } catch {
      return { form: t("auth.offline") };
    }
    if (response.ok) {
      showToast(t("auth.password_changed"));
      navigate(ROUTES.inbox);
      return;
    }
    const body = await response.json().catch(() => null);
    if (body?.error?.code === "auth.reset_expired") return { expired: true };
    if (body?.error?.fields?.password)
      return { password: body.error.fields.password[0] };
    return {
      form: t("error.generic", { request_id: body?.error?.request_id ?? "" }),
    };
  }

  if (link === undefined) return null;
  return (
    <ResetPasswordScreen
      email={link?.email ?? null}
      onSubmit={reset}
      forgotPasswordHref={ROUTES.forgotPassword}
      navigate={navigate}
      offline={offline}
    />
  );
}
