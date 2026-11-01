import type { ReactElement } from "react";
import { ChipGroup, type ChipOption } from "../../../components/ChipGroup";
import { FlagIcon } from "../../../components/icons";
import { t } from "../../../copy";
import type { Priority } from "../../../domain/types";
import type { PriorityChipsProps } from "./types";

export function PriorityChips({
  value,
  onChange,
}: PriorityChipsProps): ReactElement {
  const options: ReadonlyArray<ChipOption<Priority>> = [
    { value: "low", label: t("priority.low") },
    {
      value: "medium",
      label: t("priority.medium"),
      icon: <FlagIcon size={14} className="text-warning" />,
    },
    {
      value: "high",
      label: t("priority.high"),
      icon: <FlagIcon size={14} className="text-error" />,
    },
  ];

  return (
    <ChipGroup<Priority>
      label={t("task.priority")}
      showLabel
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}
