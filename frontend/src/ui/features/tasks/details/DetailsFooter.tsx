import type { ReactElement } from "react";
import { t } from "../../../copy";
import { formatDay, formatTime } from "../../../domain/dates";
import type { TimeFormat } from "../../../domain/types";

export interface DetailsFooterProps {
  createdAt: string;
  updatedAt?: string;
  todayDate: string;
  timeFormat: TimeFormat;
}

export function DetailsFooter({
  createdAt,
  updatedAt,
  todayDate,
  timeFormat,
}: DetailsFooterProps): ReactElement {
  const createdStr = t("task.created", {
    date: formatDay(createdAt.slice(0, 10), todayDate),
  });

  let editedStr: string | null = null;
  if (updatedAt) {
    const datePart = formatDay(updatedAt.slice(0, 10), todayDate);
    const timePart =
      updatedAt.length >= 16
        ? ` ${formatTime(updatedAt.slice(11, 16), timeFormat)}`
        : "";
    editedStr = t("task.edited", {
      date: `${datePart}${timePart}`,
    });
  }

  return (
    <p className="text-center text-footnote text-ink-secondary">
      {createdStr}
      {editedStr ? ` · ${editedStr}` : ""}
    </p>
  );
}
