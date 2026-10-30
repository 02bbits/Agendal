import { useEffect, useRef } from "react";
import { t } from "../../copy";
import { CheckIcon } from "../../components/icons";
import { formatLongDate } from "../../domain/dates";
import { buildInbox } from "../../domain/lists";
import { nextUp } from "../../domain/progress";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";
import { ScreenHeader } from "../shell/ScreenHeader";
import { ProgressSummary } from "../tasks/ProgressSummary";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";
import { Section } from "./Section";

export interface InboxScreenProps {
  accountInitial?: string;
  navigate?: Navigate;
  showHeader?: boolean;
}

/** Inbox (LV-1): today's progress, Overdue before Today, No date and Completed collapsed. */
export function InboxScreen({
  accountInitial = "",
  navigate,
  showHeader = true,
}: InboxScreenProps) {
  const store = useTaskStore();
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
        <>
          {!allDone && (
            <ProgressSummary
              progress={view.progress}
              next={nextUp(
                [...view.today, ...view.overdue].filter((x) => !x.done),
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
            >
              {view.noDate.map((x) => row(x, { showDue: true }))}
            </Section>
          )}
          {view.completed.length > 0 && (
            <Section
              title={t("list.completed")}
              count={view.completed.length}
              collapsible
            >
              {view.completed.map((x) => row(x))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
