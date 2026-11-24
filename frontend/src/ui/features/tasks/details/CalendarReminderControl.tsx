import { useId, useState, type ReactElement } from "react";
import {
  BellIcon,
  CornerDownRightIcon,
  XIcon,
} from "../../../components/icons";
import { NumberStepper } from "../../../components/NumberStepper";
import {
  SelectDropdown,
  type SelectOption,
} from "../../../components/SelectDropdown";
import { t } from "../../../copy";
import { cx } from "../../../components/cx";
import type { TaskPatch } from "../../../domain/api";
import type { Reminder, Task, TimeFormat } from "../../../domain/types";
import { SettingsRow } from "./SettingsRow";

export type ReminderUnitName = "minutes" | "hours" | "days" | "weeks";

export interface ParsedReminder {
  value: number;
  unit: ReminderUnitName;
}

export function parseReminderString(
  reminder: Reminder | null | undefined,
): ParsedReminder {
  if (!reminder || reminder === "none") {
    return { value: 10, unit: "minutes" };
  }
  if (reminder === "0m") {
    return { value: 0, unit: "minutes" };
  }
  const match = String(reminder).match(/^(\d+)([mhdw])$/);
  if (!match) {
    return { value: 10, unit: "minutes" };
  }
  const val = parseInt(match[1]!, 10);
  const u = match[2]!;
  const unit: ReminderUnitName =
    u === "m" ? "minutes" : u === "h" ? "hours" : u === "d" ? "days" : "weeks";
  return { value: val, unit };
}

export function formatReminderString(
  value: number,
  unit: ReminderUnitName,
): Reminder {
  const safeVal = Math.max(0, Math.floor(value));
  const u =
    unit === "minutes"
      ? "m"
      : unit === "hours"
        ? "h"
        : unit === "days"
          ? "d"
          : "w";
  return `${safeVal}${u}` as Reminder;
}

export function computeReminderPreview(
  dateStr: string | null,
  timeStr: string | null,
  value: number,
  unit: ReminderUnitName,
  timeFormat: TimeFormat = "24h",
): string | null {
  if (!dateStr) return null;
  const time = timeStr || "09:00";
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, min] = time.split(":").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day, hour ?? 9, min ?? 0);
  let subtractMinutes = value;
  if (unit === "hours") subtractMinutes = value * 60;
  else if (unit === "days") subtractMinutes = value * 1440;
  else if (unit === "weeks") subtractMinutes = value * 10080;

  const targetDate = new Date(date.getTime() - subtractMinutes * 60 * 1000);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dName = days[targetDate.getDay()];
  const mName = months[targetDate.getMonth()];
  const dNum = targetDate.getDate();

  let formattedTime = `${String(targetDate.getHours()).padStart(2, "0")}:${String(
    targetDate.getMinutes(),
  ).padStart(2, "0")}`;
  if (timeFormat === "12h") {
    const h = targetDate.getHours();
    const m = String(targetDate.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    formattedTime = `${h12}:${m} ${ampm}`;
  }

  // Format without excess middle dots
  return `${dName}, ${dNum} ${mName}, ${formattedTime}`;
}

export interface CalendarReminderControlProps {
  task: Task;
  disabled?: boolean;
  blocked?: boolean;
  timeFormat?: TimeFormat;
  onSave: (patch: TaskPatch) => void;
  variant?: "panel" | "screen";
}

interface ActiveReminderCardData {
  key: string;
  anchor: "start" | "due";
  value: number;
  unit: ReminderUnitName;
  preview: string | null;
  anchorDisabled: boolean;
  onUpdate: (val: number, unit: ReminderUnitName) => void;
  onAnchorChange: (
    anchor: "start" | "due",
    val: number,
    unit: ReminderUnitName,
  ) => void;
  onRemove: () => void;
}

function ReminderCard({
  id,
  card,
  unitOptions,
  anchorOptions,
  canChooseAnchor,
  hasStart,
}: {
  id: string;
  card: ActiveReminderCardData;
  unitOptions: ReadonlyArray<SelectOption<ReminderUnitName>>;
  anchorOptions: ReadonlyArray<SelectOption<"start" | "due">>;
  canChooseAnchor: boolean;
  hasStart: boolean;
}) {
  const [prevVal, setPrevVal] = useState(card.value);
  const [val, setVal] = useState(card.value);
  if (card.value !== prevVal) {
    setPrevVal(card.value);
    setVal(card.value);
  }

  const [prevUnit, setPrevUnit] = useState(card.unit);
  const [unit, setUnit] = useState(card.unit);
  if (card.unit !== prevUnit) {
    setPrevUnit(card.unit);
    setUnit(card.unit);
  }

  const handleValChange = (nextVal: number) => {
    setVal(nextVal);
    card.onUpdate(nextVal, unit);
  };

  const handleUnitChange = (nextUnit: ReminderUnitName) => {
    setUnit(nextUnit);
    card.onUpdate(val, nextUnit);
  };

  const handleAnchorChange = (newAnchor: "start" | "due") => {
    card.onAnchorChange(newAnchor, val, unit);
  };

  return (
    <div className="flex flex-col gap-2 rounded-box border border-separator/60 bg-fill/20 p-2.5 w-full">
      <div className="flex items-center gap-2 w-full flex-wrap sm:flex-nowrap">
        {/* Value Stepper */}
        <NumberStepper
          id={`${id}-val`}
          ariaLabel={t("task.reminder_value")}
          value={val}
          min={0}
          max={999}
          size="sm"
          onChange={handleValChange}
          decreaseLabel={t("common.decrease")}
          increaseLabel={t("common.increase")}
        />

        {/* Unit selector using system SelectDropdown */}
        <SelectDropdown<ReminderUnitName>
          label={t("task.unit_minutes")}
          hideLabel
          size="sm"
          options={unitOptions}
          value={unit}
          onChange={handleUnitChange}
          className="w-28 sm:w-32 shrink-0"
        />

        {/* Anchor selector using system SelectDropdown */}
        {canChooseAnchor ? (
          <SelectDropdown<"start" | "due">
            label={t("task.anchor_start")}
            hideLabel
            size="sm"
            options={anchorOptions}
            value={card.anchor}
            disabled={card.anchorDisabled}
            onChange={handleAnchorChange}
            className="flex-1 min-w-[150px] sm:max-w-[200px]"
          />
        ) : (
          <span className="text-footnote text-ink-secondary whitespace-nowrap px-1">
            {hasStart ? t("task.anchor_start") : t("task.anchor_due")}
          </span>
        )}

        {/* Delete button */}
        <button
          type="button"
          aria-label={t("task.remove_reminder")}
          onClick={card.onRemove}
          className="ml-auto shrink-0 flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-secondary hover:bg-surface hover:text-ink transition-colors"
        >
          <XIcon size={16} />
        </button>
      </div>

      {card.preview && (
        <div className="flex items-center gap-1.5 px-0.5 text-footnote text-ink-secondary">
          <CornerDownRightIcon
            size={14}
            className="text-ink-tertiary shrink-0"
          />
          <span>{card.preview}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Calendar-style Notification & Reminder Control (#186, Google Calendar design):
 * - Clean row layout matching Project, Start date, Due, and Repeat.
 * - "+ Add notification" button right-aligned on the Reminder row.
 * - Custom touch-friendly number stepper with - / + buttons for mobile and desktop.
 * - Interactive anchor selector between start date and due date.
 * - Lucide CornerDownRightIcon for derived preview timestamp without excess middle dots.
 */
export function CalendarReminderControl({
  task,
  disabled = false,
  blocked = false,
  timeFormat = "24h",
  onSave,
  variant = "panel",
}: CalendarReminderControlProps): ReactElement {
  const isScreen = variant === "screen";
  const id = useId();

  const hasStart = Boolean(task.start_date);
  const hasDue = Boolean(task.due_date);
  const hasDates = hasStart || hasDue;
  const canChooseAnchor = hasStart && hasDue;

  const startReminderActive = Boolean(
    task.reminder && task.reminder !== "none",
  );
  const dueReminderActive = Boolean(
    task.due_reminder && task.due_reminder !== "none",
  );
  const hasActiveReminders = startReminderActive || dueReminderActive;

  const parsedStart = parseReminderString(task.reminder);
  const parsedDue = parseReminderString(task.due_reminder);

  const activeCount =
    (startReminderActive ? 1 : 0) + (dueReminderActive ? 1 : 0);
  const bothActive = startReminderActive && dueReminderActive;

  // Timestamps
  const startPreview = startReminderActive
    ? computeReminderPreview(
        task.start_date ?? task.due_date,
        task.start_date ? task.start_time : task.due_time,
        parsedStart.value,
        parsedStart.unit,
        timeFormat,
      )
    : null;

  const duePreview = dueReminderActive
    ? computeReminderPreview(
        task.due_date,
        task.due_time,
        parsedDue.value,
        parsedDue.unit,
        timeFormat,
      )
    : null;

  const canAddMore =
    !disabled && hasDates && activeCount < (canChooseAnchor ? 2 : 1);

  const handleAddNotification = () => {
    if (!hasDates) return;
    if (activeCount === 0) {
      onSave({ reminder: "10m" });
      return;
    }
    if (activeCount === 1) {
      if (dueReminderActive) {
        // Due is already active, so the remaining one is start
        onSave({ reminder: "10m" });
      } else {
        // Start is already active, so the remaining one is due
        onSave({ due_reminder: "10m" });
      }
    }
  };

  const unitOptions: ReadonlyArray<SelectOption<ReminderUnitName>> = [
    { value: "minutes", label: t("task.unit_minutes") },
    { value: "hours", label: t("task.unit_hours") },
    { value: "days", label: t("task.unit_days") },
    { value: "weeks", label: t("task.unit_weeks") },
  ];

  const anchorOptions: ReadonlyArray<SelectOption<"start" | "due">> = [
    { value: "start", label: t("task.anchor_start") },
    { value: "due", label: t("task.anchor_due") },
  ];

  // Build card representations
  const cards: ActiveReminderCardData[] = [];

  if (bothActive) {
    cards.push({
      key: "card-start",
      anchor: "start",
      value: parsedStart.value,
      unit: parsedStart.unit,
      preview: startPreview,
      anchorDisabled: true, // Both active -> cannot change anchor
      onUpdate: (val, unit) =>
        onSave({ reminder: formatReminderString(val, unit) }),
      onAnchorChange: () => {},
      onRemove: () => onSave({ reminder: "none" }),
    });

    cards.push({
      key: "card-due",
      anchor: "due",
      value: parsedDue.value,
      unit: parsedDue.unit,
      preview: duePreview,
      anchorDisabled: true, // Both active -> cannot change anchor
      onUpdate: (val, unit) =>
        onSave({ due_reminder: formatReminderString(val, unit) }),
      onAnchorChange: () => {},
      onRemove: () => onSave({ due_reminder: "none" }),
    });
  } else if (activeCount === 1) {
    const isDue = dueReminderActive;
    const currentParsed = isDue ? parsedDue : parsedStart;
    const preview = isDue ? duePreview : startPreview;

    cards.push({
      // Stable key ensures SelectDropdown doesn't unmount upon anchor change!
      key: "single-card",
      anchor: isDue ? "due" : "start",
      value: currentParsed.value,
      unit: currentParsed.unit,
      preview,
      anchorDisabled: false,
      onUpdate: (val, unit) => {
        const rem = formatReminderString(val, unit);
        onSave(isDue ? { due_reminder: rem } : { reminder: rem });
      },
      onAnchorChange: (newAnchor, currentVal, currentUnit) => {
        if (
          (isDue && newAnchor === "start") ||
          (!isDue && newAnchor === "due")
        ) {
          const rem = formatReminderString(currentVal, currentUnit);
          if (newAnchor === "due") {
            onSave({ reminder: "none", due_reminder: rem });
          } else {
            onSave({ reminder: rem, due_reminder: "none" });
          }
        }
      },
      onRemove: () => {
        onSave(isDue ? { due_reminder: "none" } : { reminder: "none" });
      },
    });
  }

  const headerControl = (
    <>
      {canAddMore && (
        <button
          id={`${id}-add-btn`}
          type="button"
          onClick={handleAddNotification}
          aria-label={`+ ${t("task.add_notification")}`}
          className="flex items-center gap-1 text-footnote font-medium text-ink-secondary hover:text-ink hover:underline cursor-pointer"
        >
          <span>+</span>
          <span>{t("task.add_notification")}</span>
        </button>
      )}
      {!hasDates && (
        <span id={`${id}-add-btn`} className="text-footnote text-ink-secondary">
          {t("task.reminder_needs_date")}
        </span>
      )}
    </>
  );

  if (!hasActiveReminders) {
    return (
      <SettingsRow
        variant={variant}
        icon={<BellIcon size={18} />}
        label={t("task.reminder")}
        labelFor={`${id}-add-btn`}
        control={headerControl}
      />
    );
  }

  return (
    <div
      className={cx(
        "flex flex-col",
        isScreen ? "pb-3.5" : "border-b border-separator pb-2.5",
      )}
    >
      <SettingsRow
        variant={variant}
        icon={<BellIcon size={18} />}
        label={t("task.reminder")}
        labelFor={`${id}-${cards[0]?.anchor}-val`}
        control={headerControl}
        className={isScreen ? "pb-2" : "border-b-0 pb-2"}
      />

      {blocked && (
        <div
          className={cx(
            "rounded-lg bg-error/10 px-3 py-1.5 text-footnote text-error my-1",
            isScreen ? "mx-4" : "",
          )}
        >
          {t("task.push_denied")}
        </div>
      )}

      {/* Active Reminder Cards */}
      <div className={cx("flex flex-col gap-2 w-full", isScreen ? "px-4" : "")}>
        {cards.map((card) => (
          <ReminderCard
            key={card.key}
            id={`${id}-${card.anchor}`}
            card={card}
            unitOptions={unitOptions}
            anchorOptions={anchorOptions}
            canChooseAnchor={canChooseAnchor}
            hasStart={hasStart}
          />
        ))}
      </div>
    </div>
  );
}
