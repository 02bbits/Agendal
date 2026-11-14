import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import CodeSlots, { type CodeSlotsStatus } from "../../components/CodeSlots";
import { cx } from "../../components/cx";
import { AlertCircleIcon, CheckCircleIcon } from "../../components/icons";
import { t } from "../../copy";

export interface CodeCheckResult {
  ok: boolean;
  status?: number;
  /** The API error code, e.g. auth.verify_too_many */
  code?: string;
  message?: string;
  /** Seconds to wait, with a 429 */
  retryAfter?: number;
  user?: unknown;
}

export interface CodeResendResult {
  ok: boolean;
  status?: number;
  retryAfter?: number;
  message?: string;
}

export interface CodeEntryProps {
  onCheck?(code: string): Promise<CodeCheckResult>;
  onResend?(): Promise<CodeResendResult>;
  /** The right code, after the check mark */
  onVerified(user: unknown): void;
  /** Any other answer the screen handles itself (e.g. the sign-in expired); true when handled */
  onOther?(result: CodeCheckResult): boolean;
}

/** Seconds between two codes, as the server counts them (AA §2.8) */
export const RESEND_AFTER = 60;

// The answers that end a code: only a new one helps
const DEAD_CODES = new Set(["auth.verify_too_many", "auth.verify_expired"]);

/** A wait as people read it: "45 s" under a minute, "29:05" from a minute up. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

type Notice =
  | { kind: "wrong"; text: string }
  | { kind: "dead"; text: string }
  | { kind: "sent" }
  | { kind: "send_limited" }
  | { kind: "error"; text: string };

/**
 * The 6 slots, one message line and Send a new code (AA §2.8, §2.9). Each code takes 5 tries:
 * after the 5th wrong one (or once it expires) the slots empty and stay disabled until a new
 * code is sent, 60 s after the last one. While a code is checked the slots are disabled too,
 * so more typing can't change it. The message area keeps its height, so nothing below moves.
 */
export function CodeEntry({
  onCheck,
  onResend,
  onVerified,
  onOther,
}: CodeEntryProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<CodeSlotsStatus>("idle");
  const [checking, setChecking] = useState(false);
  const [dead, setDead] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Counted down here, not read from the clock while rendering (the page is prerendered)
  const [resendIn, setResendIn] = useState(RESEND_AFTER);
  const [resending, setResending] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((left) => Math.max(0, left - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleComplete = async (entered: string) => {
    if (checking || dead) return;
    setNotice(null);
    setChecking(true);
    let res: CodeCheckResult;
    try {
      res = onCheck
        ? await onCheck(entered)
        : { ok: false, status: 500, message: t("error.generic") };
    } catch {
      res = { ok: false, status: 500, message: t("error.generic") };
    }
    if (!isMounted.current) return;
    setChecking(false);

    if (res.ok) {
      setStatus("success");
      setTimeout(() => {
        if (isMounted.current) onVerified(res.user);
      }, 700);
    } else if (onOther?.(res)) {
      return;
    } else if (res.code && DEAD_CODES.has(res.code)) {
      // This code is used up: empty and disable the slots until a new one is sent
      setDead(true);
      setCode("");
      setStatus("idle");
      setNotice({
        kind: "dead",
        // Our own words: the server message repeats "Send a new code", shown just below
        text: t(
          res.code === "auth.verify_expired"
            ? "auth.code_expired_title"
            : "auth.code_used_up",
        ),
      });
    } else if (res.status === 422) {
      setStatus("error");
      setNotice({ kind: "wrong", text: res.message ?? t("auth.verify_wrong") });
    } else {
      setCode("");
      setNotice({ kind: "error", text: res.message ?? t("error.generic") });
    }
  };

  // The slots empty themselves after the error shake: the message stays until the user types
  const handleChange = (next: string) => {
    setCode(next);
    if (status === "error") setStatus("idle");
    if (next !== "" && notice?.kind === "wrong") setNotice(null);
  };

  const handleResend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);

    try {
      const res = onResend ? await onResend() : { ok: true };
      if (!isMounted.current) return;

      if (res.ok) {
        // A new code: the old digits go and the slots open again
        setDead(false);
        setCode("");
        setStatus("idle");
        setNotice({ kind: "sent" });
        setResendIn(RESEND_AFTER);
      } else if (res.status === 429) {
        const wait = res.retryAfter ?? RESEND_AFTER;
        setResendIn(wait);
        // Past the 60 s rule, the wait is the 10-codes-per-30-minutes one: say so
        if (wait > RESEND_AFTER) setNotice({ kind: "send_limited" });
      } else {
        setNotice({
          kind: "error",
          text: res.message ?? t("error.generic"),
        });
      }
    } catch {
      if (!isMounted.current) return;
      setNotice({ kind: "error", text: t("error.generic") });
    } finally {
      if (isMounted.current) setResending(false);
    }
  };

  // The red notice already counts down: the button then just says what it does
  const waitShown = notice?.kind === "dead" || notice?.kind === "send_limited";
  const resendLabel =
    resendIn > 0 && !waitShown
      ? t("auth.verify_resend_wait", { time: formatWait(resendIn) })
      : t("auth.verify_resend");

  return (
    <>
      <div className="mt-7 flex justify-center">
        <CodeSlots
          autoFocus
          slotSize={48}
          value={code}
          status={status}
          disabled={checking || dead}
          onComplete={handleComplete}
          onChange={handleChange}
        />
      </div>

      {/* One message at a time, in a space that keeps its height */}
      <div className="mt-4 flex min-h-[62px] items-start justify-center">
        {notice?.kind === "dead" || notice?.kind === "send_limited" ? (
          <div
            role="alert"
            className="flex w-full max-w-[340px] items-start gap-2.5 rounded-field bg-danger-tint px-3.5 py-3 text-footnote text-error"
          >
            <AlertCircleIcon size={18} aria-hidden className="mt-px shrink-0" />
            <div className="min-w-0">
              <p className="m-0 font-semibold">
                {notice.kind === "dead"
                  ? notice.text
                  : t("auth.resend_limited")}
              </p>
              <p className="m-0 mt-0.5 text-ink-secondary">
                {resendIn > 0
                  ? t("auth.resend_wait_hint", { time: formatWait(resendIn) })
                  : t("auth.resend_now_hint")}
              </p>
            </div>
          </div>
        ) : notice?.kind === "sent" ? (
          // The same box as the red notice, in green, so both read as one family
          <div
            role="status"
            className="flex w-full max-w-[340px] items-start gap-2.5 rounded-field bg-success-tint px-3.5 py-3 text-footnote text-success"
          >
            <CheckCircleIcon size={18} aria-hidden className="mt-px shrink-0" />
            <div className="min-w-0">
              <p className="m-0 font-semibold">{t("auth.verify_sent")}</p>
              <p className="m-0 mt-0.5 text-ink-secondary">
                {t("auth.verify_sent_hint")}
              </p>
            </div>
          </div>
        ) : notice ? (
          <p
            role="alert"
            className="m-0 flex items-center gap-1.5 text-footnote text-error"
          >
            <AlertCircleIcon size={16} aria-hidden className="shrink-0" />
            {notice.text}
          </p>
        ) : null}
      </div>

      <div className="mt-1 flex justify-center">
        {dead && resendIn === 0 ? (
          // The only way on: make it the clear next step
          <Button
            type="button"
            variant="secondary"
            size="sm"
            busy={resending}
            onClick={handleResend}
          >
            {t("auth.verify_resend")}
          </Button>
        ) : (
          <button
            type="button"
            disabled={resendIn > 0 || resending}
            onClick={handleResend}
            className={cx(
              "focus-ring inline-flex min-h-11 cursor-pointer items-center px-2 text-footnote font-semibold text-primary tabular-nums",
              "disabled:cursor-not-allowed disabled:font-normal disabled:text-ink-tertiary",
            )}
          >
            {resendLabel}
          </button>
        )}
      </div>
    </>
  );
}
