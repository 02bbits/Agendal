import type { ReactElement } from "react";
import { DatePicker } from "../../../components/DatePicker";
import { CalendarIcon } from "../../../components/icons";
import { t } from "../../../copy";
import type { WeekStart } from "../../../domain/types";
import { SettingsRow } from "./SettingsRow";

export interface DueDateFieldProps {
  value: string | null;
  todayDate: string;
  onSave: (due_date: string | null) => void;
  variant?: "panel" | "screen";
  weekStart?: WeekStart;
}

export function DueDateField({
  value,
  onSave,
  variant = "panel",
  weekStart = "mon",
}: DueDateFieldProps): ReactElement {
  const control = (
    <DatePicker
      id="task-due"
      label={t("task.due")}
      value={value}
      onChange={(val) => onSave(val || null)}
      weekStart={weekStart}
      variant={variant}
    />
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
