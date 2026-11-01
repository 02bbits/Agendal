import type { ReactElement } from "react";
import { ChipGroup, type ChipOption } from "../../../components/ChipGroup";
import { TextField } from "../../../components/TextField";
import { t } from "../../../copy";
import type { DueChip } from "../../../domain/newTask";
import type { DueChipsProps } from "./types";

export function DueChips({
  value,
  picked,
  onChange,
  onPickedChange,
  onCancelPick,
}: DueChipsProps): ReactElement {
  const options: ReadonlyArray<ChipOption<DueChip>> = [
    { value: "today", label: t("date.today") },
    { value: "tomorrow", label: t("date.tomorrow") },
    { value: "next_week", label: t("task.next_week") },
    { value: "none", label: t("task.no_date") },
    { value: "pick", label: t("task.pick_date") },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ChipGroup<DueChip>
        label={t("task.due")}
        showLabel
        options={options}
        value={value}
        onChange={onChange}
      />
      {value === "pick" && (
        <TextField
          label={t("task.pick_date")}
          type="date"
          value={picked}
          onChange={(e) => onPickedChange(e.target.value)}
          onBlur={() => {
            if (!picked) onCancelPick();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onCancelPick();
            }
          }}
        />
      )}
    </div>
  );
}
