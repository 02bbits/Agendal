import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { t, type CopyKey } from "../../copy";
import { now } from "../../../lib/clock";
import type { ApiRequestError } from "../../../lib/apiError";
import { RateLimitIllustration } from "./RateLimitIllustration";

/** How a longer window reads in "{max} requests per {per}". */
const PER: Record<number, CopyKey> = {
  60: "rate.per_minute",
  3600: "rate.per_hour",
  86400: "rate.per_day",
};

/** When the wait for a 429 ends, in ms: its `Retry-After`, or a second without one. */
const deadline = (error: ApiRequestError) =>
  now().getTime() + (error.retryAfter ?? 1) * 1000;

/** Whole seconds left until `until` (ms), never below 0. */
const secondsUntil = (until: number) =>
  Math.max(0, Math.ceil((until - now().getTime()) / 1000));

/**
 * A screen's load got a 429 (UX-43): an illustration and the limit it hit, a burst ("too fast")
 * or the most allowed in a window ("too many"). Try again waits out `Retry-After`.
 */
export function RateLimited({
  error,
  onRetry,
}: {
  error: ApiRequestError;
  onRetry: () => void;
}) {
  // A new 429 (Try again was limited too) starts its own countdown
  const [timing, setTiming] = useState(() => ({
    error,
    until: deadline(error),
  }));
  if (timing.error !== error) setTiming({ error, until: deadline(error) });
  const [tick, setTick] = useState(0);
  const left = secondsUntil(timing.until);

  useEffect(() => {
    if (left === 0) return;
    const timer = setTimeout(() => setTick((n) => n + 1), 1000);
    return () => clearTimeout(timer);
  }, [left, tick, timing]);

  const { limit } = error;
  const burst = limit?.window === 1;
  const per = limit && PER[limit.window];
  const cause = burst
    ? t("rate.burst_body")
    : per
      ? t("rate.window_body", { max: String(limit.max), per: t(per) })
      : "";
  const wait = left > 0 ? t("rate.wait", { seconds: String(left) }) : "";

  return (
    <EmptyState
      icon={<RateLimitIllustration />}
      title={t(burst ? "rate.burst_title" : "rate.window_title")}
      body={[cause, wait].filter(Boolean).join(" ") || undefined}
      action={
        <Button disabled={left > 0} onClick={onRetry}>
          {left > 0
            ? t("rate.try_again_in", { seconds: String(left) })
            : t("rate.try_again")}
        </Button>
      }
    />
  );
}
