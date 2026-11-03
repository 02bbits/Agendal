import { useRef, type ReactElement } from "react";
import { ChipGroup, type ChipOption } from "../../../components/ChipGroup";
import { DateField } from "../../../components/DateField";
import { t } from "../../../copy";
import type { DueChip } from "../../../domain/newTask";
import type { DueChipsProps } from "./types";

export function DueChips({
  value,
  picked,
  onChange,
  onPickedChange,
  onCancelPick,
  weekStart = "mon",
}: DueChipsProps): ReactElement {
  const pickChipRef = useRef<HTMLButtonElement | null>(null);

  const options: ReadonlyArray<ChipOption<DueChip>> = [
    { value: "none", label: t("task.no_date") },
    { value: "today", label: t("date.today") },
    { value: "tomorrow", label: t("date.tomorrow") },
    { value: "next_week", label: t("task.next_week") },
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
        itemRef={(v, el) => {
          if (v === "pick") {
            pickChipRef.current = el;
          }
        }}
      />
      {value === "pick" && (
        <DateField
          label={t("task.pick_date")}
          value={picked || null}
          onChange={(v) => onPickedChange(v ?? "")}
          onCommit={() => pickChipRef.current?.focus()}
          onCancel={onCancelPick}
          onLeave={() => {
            if (!picked) onCancelPick();
          }}
          weekStart={weekStart}
          autoFocus
        />
      )}
    </div>
  );
}
