"use client";

import { ChipGroup } from "@/ui/components/ChipGroup";
import { CalendarIcon, ClockIcon } from "@/ui/components/icons";
import { t } from "@/ui/copy";
import type { UpcomingFilter } from "@/ui/domain/lists";

/** All, Scheduled (start dates) or Due: the chips over Upcoming. `md` is the desktop size. */
export function UpcomingFilterChips({
  value,
  onChange,
  size,
}: {
  value: UpcomingFilter;
  onChange: (filter: UpcomingFilter) => void;
  size?: "md";
}) {
  const iconSize = size === "md" ? 16 : 14;
  return (
    <ChipGroup
      label={t("list.filter_label")}
      value={value}
      onChange={(next) => onChange(next as UpcomingFilter)}
      size={size}
      options={[
        { value: "all", label: t("list.filter_all") },
        {
          value: "scheduled",
          label: t("list.filter_scheduled"),
          icon: <ClockIcon size={iconSize} />,
        },
        {
          value: "due",
          label: t("list.filter_due"),
          icon: <CalendarIcon size={iconSize} />,
        },
      ]}
    />
  );
}
