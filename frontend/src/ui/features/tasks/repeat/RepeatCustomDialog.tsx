import { useWideScreen } from "../../../components/useMediaQuery";
import { useId, useState, type ReactElement } from "react";
import { Button } from "../../../components/Button";
import { cx } from "../../../components/cx";
import { DatePicker } from "../../../components/DatePicker";
import { Dialog } from "../../../components/Dialog";
import { NumberStepper } from "../../../components/NumberStepper";
import { Segmented } from "../../../components/Segmented";
import { t } from "../../../copy";
import {
  buildRule,
  monthModeLabels,
  orderedWeekdays,
  parseRule,
  weekdayShortName,
  type CustomRepeat,
  type RepeatValue,
} from "../../../domain/repeatPresets";
import type { WeekStart } from "../../../domain/types";

export interface RepeatCustomDialogProps {
  open: boolean;
  /** The current repeat, to start from. */
  value: RepeatValue;
  /** The date the series starts on (the start date, else the due date, else today). */
  anchor: string;
  weekStart?: WeekStart;
  onDone: (value: RepeatValue) => void;
  onCancel: () => void;
}

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

/** Custom repeat (#154): every N days/weeks/months/years, weekdays, month pattern, an end. */
export function RepeatCustomDialog({
  open,
  value,
  anchor,
  weekStart = "mon",
  onDone,
  onCancel,
}: RepeatCustomDialogProps): ReactElement {
  const [draft, setDraft] = useState<CustomRepeat>(() => {
    return parseRule(value, anchor);
  });
  const id = useId();
  const update = (patch: Partial<CustomRepeat>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const monthLabels = monthModeLabels(anchor);
  const unitLabel = {
    daily: t("repeat_unit.day"),
    weekly: t("repeat_unit.week"),
    monthly: t("repeat_unit.month"),
    yearly: t("repeat_unit.year"),
  };

  // From 768px the end-date calendar sits beside the rule, always shown and only usable with
  // Ends: On; on a phone it shows under Ends as soon as On is picked
  const isWide = useWideScreen();
  const endsOn = draft.end.kind === "on";
  const calendar = (
    <DatePicker
      inline
      alwaysOpen
      label={t("repeat_end.on")}
      value={draft.end.kind === "on" ? draft.end.date : null}
      disabled={!endsOn}
      weekStart={weekStart}
      onChange={(date) => update({ end: { kind: "on", date } })}
    />
  );

  return (
    <Dialog
      open={open}
      title={t("repeat_custom.title")}
      onClose={onCancel}
      size={isWide ? "xwide" : "wide"}
      actionsLayout="row"
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => onDone(buildRule(draft, anchor))}
          >
            {t("repeat_custom.done")}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`${id}-interval`}
              className="text-footnote font-semibold text-ink-secondary"
            >
              {t("repeat_custom.every")}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <NumberStepper
                id={`${id}-interval`}
                min={1}
                max={999}
                // 0 while retyping; Done clamps it to 1–999
                value={draft.interval}
                onChange={(interval) => update({ interval })}
                decreaseLabel={t("common.decrease")}
                increaseLabel={t("common.increase")}
              />
              <Segmented
                label={t("repeat_custom.every")}
                options={FREQUENCIES.map((frequency) => ({
                  value: frequency,
                  label: unitLabel[frequency],
                }))}
                value={draft.frequency}
                onChange={(frequency) => update({ frequency })}
              />
            </div>
          </div>

          {draft.frequency === "weekly" && (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-footnote font-semibold text-ink-secondary">
                {t("repeat_custom.on_days")}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {orderedWeekdays(weekStart).map((code) => {
                  const on = draft.days.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const days = on
                          ? draft.days.filter((d) => d !== code)
                          : [...draft.days, code];
                        // At least one day stays picked
                        if (days.length) update({ days });
                      }}
                      className={cx(
                        "focus-ring inline-flex size-11 cursor-pointer items-center justify-center rounded-full border text-footnote font-semibold",
                        on
                          ? "border-transparent bg-ink text-paper"
                          : "border-separator bg-transparent text-ink-secondary hover:text-ink",
                      )}
                    >
                      {weekdayShortName(code).slice(0, 2)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {draft.frequency === "monthly" && (
            <Segmented
              label={t("repeat_custom.on_days")}
              options={[
                { value: "day", label: monthLabels.day },
                { value: "weekday", label: monthLabels.weekday },
              ]}
              value={draft.monthMode}
              onChange={(monthMode) => update({ monthMode })}
              wrap
            />
          )}

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-footnote font-semibold text-ink-secondary">
              {t("repeat_end.label")}
            </legend>
            <Segmented
              label={t("repeat_end.label")}
              options={[
                { value: "never", label: t("repeat_end.never") },
                { value: "on", label: t("repeat_end.on") },
                { value: "after", label: t("repeat_end.after") },
              ]}
              value={draft.end.kind}
              onChange={(kind) =>
                update({
                  end:
                    kind === "on"
                      ? { kind, date: anchor }
                      : kind === "after"
                        ? { kind, count: 10 }
                        : { kind },
                })
              }
            />
            {!isWide && endsOn && calendar}
            {draft.end.kind === "after" && (
              <div className="flex items-center gap-3">
                <NumberStepper
                  ariaLabel={t("repeat_end.after")}
                  min={1}
                  max={1000}
                  value={draft.end.count}
                  onChange={(count) =>
                    update({ end: { kind: "after", count } })
                  }
                  decreaseLabel={t("common.decrease")}
                  increaseLabel={t("common.increase")}
                />
                <span className="text-body text-ink-secondary">
                  {t("repeat_end.times")}
                </span>
              </div>
            )}
          </fieldset>
        </div>
        {isWide && calendar}
      </div>
    </Dialog>
  );
}
