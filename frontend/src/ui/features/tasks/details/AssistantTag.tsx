import type { ReactElement } from "react";
import { SparklesIcon } from "../../../components/icons";
import { t } from "../../../copy";
import { Link } from "../../shell/Link";
import type { Navigate } from "../../shell/routes";

export interface AssistantTagProps {
  createdBy: "user" | "assistant";
  sourceNote?: { name: string; href: string };
  navigate?: Navigate;
}

export function AssistantTag({
  createdBy,
  sourceNote,
  navigate,
}: AssistantTagProps): ReactElement | null {
  if (createdBy !== "assistant") return null;

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-footnote text-ink-secondary">
      <SparklesIcon size={14} aria-hidden="true" />
      <span>{t("task.created_by_assistant")}</span>
      {sourceNote?.href ? (
        <>
          <span aria-hidden="true">{"·"}</span>
          <Link
            href={sourceNote.href}
            navigate={navigate}
            className="focus-ring rounded text-primary underline underline-offset-2"
          >
            {t("task.from_note", { name: sourceNote.name })}
          </Link>
        </>
      ) : sourceNote?.name ? (
        <>
          <span aria-hidden="true">{"·"}</span>
          <span>{t("task.from_note", { name: sourceNote.name })}</span>
        </>
      ) : null}
    </p>
  );
}
