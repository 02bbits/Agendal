import type { ReactElement } from "react";
import { CalendarIcon } from "../../../components/icons";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import { SettingsRow } from "./SettingsRow";

export interface DueDateFieldProps {
  value: string | null;
  todayDate: string;
  onSave: (due_date: string | null) => void;
  variant?: "panel" | "screen";
}

export function DueDateField({
  value,
  onSave,
  variant = "panel",
}: DueDateFieldProps): ReactElement {
  const isScreen = variant === "screen";

  const control = (
    <div className="relative inline-flex items-center">
      <input
        id="task-due"
        type="date"
        aria-label={t("task.due")}
        value={value ?? ""}
        onChange={(e) => onSave(e.target.value || null)}
        className={cx(
          "focus-ring cursor-pointer border-0 text-ink focus:outline-none",
          isScreen
            ? "bg-transparent py-1 text-right text-body text-ink-secondary"
            : "rounded-full bg-fill px-3 py-1 text-footnote font-medium",
        )}
      />
    </div>
  );

  return (
    <SettingsRow
      variant={variant}
      icon={<CalendarIcon size={18} />}
      tileBg="bg-project-red/15 text-project-red"
      label={t("task.due")}
      control={control}
    />
  );
}
