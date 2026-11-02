import { useEffect, useRef, useState } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { CheckIcon } from "../../components/icons";
import { formatLongDate } from "../../domain/dates";
import { buildInbox } from "../../domain/lists";
import { nextUp } from "../../domain/progress";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";
import { ScreenHeader } from "../shell/ScreenHeader";
import { TASK_COLUMN_CLASS } from "../tasks/layout";
import { ProgressSummary } from "../tasks/ProgressSummary";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";
import { Section } from "./Section";

export const INBOX_COMPLETED_PAGE = 5;

export interface InboxScreenProps {
  accountInitial?: string;
  navigate?: Navigate;
  showHeader?: boolean;
  selectedTaskId?: string | null;
}

/** Inbox (LV-1): today's progress, Overdue before Today, No date and Completed collapsed. */
export function InboxScreen({
  accountInitial = "",
  navigate,
  showHeader = true,
  selectedTaskId,
}: InboxScreenProps) {
  const store = useTaskStore();
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [openNoDate, setOpenNoDate] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("agendal:inbox:open:no_date");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return false;
  });
  const [openCompleted, setOpenCompleted] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("agendal:inbox:open:completed");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return false;
  });

  const handleToggleNoDate = (next: boolean) => {
    setOpenNoDate(next);
    try {
      sessionStorage.setItem("agendal:inbox:open:no_date", String(next));
    } catch {}
  };

  const handleToggleCompleted = (next: boolean) => {
    setOpenCompleted(next);
    try {
      sessionStorage.setItem("agendal:inbox:open:completed", String(next));
    } catch {}
  };
  const view = buildInbox(store.tasks, store.today, {
    completedToday: store.completedToday,
    isSettling: store.isSettling,
  });
  const openCount = view.overdue.length + view.today.length;
  const allDone = !view.empty && openCount === 0;
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const prevOpen = useRef(openCount);

  // Completing the last open task moves focus to "Nothing left for today" (LV-E11)
  useEffect(() => {
    if (prevOpen.current > 0 && openCount === 0) doneHeading.current?.focus();
    prevOpen.current = openCount;
  }, [openCount]);

  const totalCompleted = view.completed.length;
  const visibleCompleted = showAllCompleted
    ? view.completed
    : view.completed.slice(0, INBOX_COMPLETED_PAGE);
  const hasHiddenCompleted =
    !showAllCompleted && INBOX_COMPLETED_PAGE < totalCompleted;

  const row = (
    task: (typeof view.today)[number],
    opts: { showDue?: boolean; overdue?: boolean } = {},
  ) => (
    <TaskRow
      key={task.id}
      task={task}
      project={store.projectOf(task)}
      today={store.today}
      timeFormat={store.timeFormat}
      onToggle={store.toggle}
      navigate={navigate}
      selected={task.id === selectedTaskId}
      settling={store.isSettling(task.id)}
      {...opts}
    />
  );

  return (
    <div className="pb-8">
      {showHeader && (
        <ScreenHeader
          overline={formatLongDate(store.today)}
          title={t("nav.inbox")}
          accountInitial={accountInitial}
          navigate={navigate}
        />
      )}

      {view.empty ? (
        <section className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <h2 className="m-0 font-serif text-dialog font-semibold text-balance focus:outline-none">
            {t("list.first_run")}
          </h2>
        </section>
      ) : (
        <div className={TASK_COLUMN_CLASS}>
          {!allDone && (
            <ProgressSummary
              progress={view.progress}
              next={nextUp(
                [...view.today, ...view.overdue].filter((x) => !x.done),
                store.today,
              )}
              timeFormat={store.timeFormat}
            />
          )}
          {allDone && (
            <section className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <span className="text-ink-tertiary" aria-hidden="true">
                <CheckIcon size={28} />
              </span>
              <h2
                ref={doneHeading}
                tabIndex={-1}
                className="m-0 font-serif text-dialog font-semibold text-balance focus:outline-none"
              >
                {t("list.nothing_left")}
              </h2>
              {view.progress.total > 0 && (
                <p className="m-0 max-w-[300px] text-callout text-ink-secondary">
                  {t("list.encourage_one")}
                </p>
              )}
              <Link
                href={ROUTES.upcoming}
                navigate={navigate}
                className="focus-ring min-h-11 cursor-pointer rounded-tile border-0 bg-transparent px-2 text-callout font-semibold text-primary"
              >
                {t("list.see_upcoming")}
              </Link>
            </section>
          )}
          {view.overdue.length > 0 && (
            <Section
              title={t("list.overdue")}
              count={view.overdue.length}
              tone="danger"
            >
              {view.overdue.map((x) =>
                row(x, { showDue: true, overdue: true }),
              )}
            </Section>
          )}
          {view.today.length > 0 && (
            <Section title={t("list.today")} count={view.today.length}>
              {view.today.map((x) => row(x))}
            </Section>
          )}
          {view.noDate.length > 0 && (
            <Section
              title={t("list.no_date")}
              count={view.noDate.length}
              collapsible
              open={openNoDate}
              onToggle={handleToggleNoDate}
            >
              {view.noDate.map((x) => row(x, { showDue: true }))}
            </Section>
          )}
          {view.completed.length > 0 && (
            <Section
              title={t("list.completed")}
              count={view.completed.length}
              collapsible
              open={openCompleted}
              onToggle={handleToggleCompleted}
              footer={
                hasHiddenCompleted ? (
                  <Button
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => setShowAllCompleted(true)}
                  >
                    {t("list.show_all")}
                  </Button>
                ) : showAllCompleted &&
                  INBOX_COMPLETED_PAGE < totalCompleted ? (
                  <Button
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => setShowAllCompleted(false)}
                  >
                    {t("list.show_less")}
                  </Button>
                ) : null
              }
            >
              {visibleCompleted.map((x) => row(x))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
