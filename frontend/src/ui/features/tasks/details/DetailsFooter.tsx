import type { ReactElement } from "react";
import { t } from "../../../copy";
import { formatDay, formatTime } from "../../../domain/dates";
import { localDateTime } from "../../../domain/edit";
import type { TimeFormat } from "../../../domain/types";

export interface DetailsFooterProps {
  createdAt: string;
  updatedAt?: string;
  todayDate: string;
  timeZone: string;
  timeFormat: TimeFormat;
  createdBy?: "user" | "assistant";
  sourceNote?: { name: string; href?: string };
}

export function DetailsFooter({
  createdAt,
  updatedAt,
  todayDate,
  timeZone,
  timeFormat,
  createdBy,
  sourceNote,
}: DetailsFooterProps): ReactElement {
  const localCreated = localDateTime(createdAt, timeZone);

  if (createdBy === "assistant") {
    const datePart = formatDay(localCreated.date, todayDate);
    const timePart = formatTime(localCreated.time, timeFormat);
    const noteText = sourceNote?.name
      ? t("task.made_from_note", { name: sourceNote.name })
      : t("task.created_by_assistant");

    return (
      <p className="text-center text-footnote text-ink-secondary">
        {"✦ "}
        {noteText}
        {" · "}
        {`${datePart} ${timePart}`}
      </p>
    );
  }

  const createdStr = t("task.created", {
    date: formatDay(localCreated.date, todayDate),
  });

  let editedStr: string | null = null;
  if (updatedAt && updatedAt !== createdAt) {
    const localUpdated = localDateTime(updatedAt, timeZone);
    const datePart = formatDay(localUpdated.date, todayDate);
    const timePart = formatTime(localUpdated.time, timeFormat);
    editedStr = t("task.edited", {
      date: `${datePart} ${timePart}`,
    });
  }

  return (
    <p className="text-center text-footnote text-ink-secondary">
      {createdStr}
      {editedStr ? ` · ${editedStr}` : ""}
    </p>
  );
}
