import type { KeyboardEvent, RefObject } from "react";
import { t } from "../../copy";
import { cx } from "../cx";
import { CheckIcon } from "../icons";

const BOX =
  "h-9 w-9 border-0 bg-transparent p-0 text-center text-body font-semibold tabular-nums text-ink outline-none placeholder:text-ink-tertiary";

/**
 * A fixed HH : MM field (#154): the colon is part of the field, so only digits go in; AM/PM
 * beside them on a 12-hour clock. Its error shows under it.
 */
export function TypedTimeField({
  hourRef,
  minuteRef,
  hour,
  minute,
  pm,
  twelve,
  error,
  errorId,
  listId,
  onHour,
  onMinute,
  onTogglePm,
  onConfirm,
  onKeyDown,
}: {
  hourRef: RefObject<HTMLInputElement | null>;
  minuteRef: RefObject<HTMLInputElement | null>;
  hour: string;
  minute: string;
  pm: boolean;
  twelve: boolean;
  error: string | null;
  errorId: string;
  /** The list the arrow keys walk. */
  listId: string;
  onHour: (raw: string) => void;
  onMinute: (raw: string) => void;
  onTogglePm: () => void;
  onConfirm: () => void;
  onKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    box: "hour" | "minute",
  ) => void;
}) {
  const field = (
    which: "hour" | "minute",
    ref: RefObject<HTMLInputElement | null>,
    value: string,
    onChange: (raw: string) => void,
  ) => (
    <input
      ref={ref}
      aria-label={t(which === "hour" ? "time.hour" : "time.minute")}
      aria-controls={listId}
      aria-invalid={error ? true : undefined}
      inputMode="numeric"
      autoComplete="off"
      placeholder={which === "hour" ? "HH" : "MM"}
      maxLength={3}
      value={value}
      onFocus={(event) => event.target.select()}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => onKeyDown(event, which)}
      className={BOX}
    />
  );

  return (
    <div className="border-b border-separator p-2">
      <div
        role="group"
        aria-label={t("time.field")}
        aria-describedby={error ? errorId : undefined}
        className={cx(
          "flex h-11 items-center gap-1 rounded-field border bg-surface px-2 focus-within:ring-2 focus-within:ring-primary/40",
          error ? "border-error" : "border-control",
        )}
      >
        {field("hour", hourRef, hour, onHour)}
        <span
          aria-hidden="true"
          className="text-body font-semibold text-ink-secondary"
        >
          :
        </span>
        {field("minute", minuteRef, minute, onMinute)}
        {twelve && (
          <button
            type="button"
            aria-label={t(pm ? "time.pm" : "time.am")}
            onClick={onTogglePm}
            className="focus-ring ml-auto min-h-8 cursor-pointer rounded-full border-0 bg-fill px-2.5 text-footnote font-semibold text-ink"
          >
            {t(pm ? "time.pm" : "time.am")}
          </button>
        )}
        <button
          type="button"
          aria-label={t("common.ok")}
          onClick={onConfirm}
          className={cx(
            "focus-ring inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-primary text-primary-content",
            !twelve && "ml-auto",
          )}
        >
          <CheckIcon size={15} />
        </button>
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="m-0 mt-1.5 text-footnote text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
