import { useEffect, useRef, useState } from "react";
import { cx } from "../../components/cx";
import { t } from "../../copy";
import { TextButton } from "../../components/TextButton";
import { CheckIcon } from "../../components/icons";
import { formatLongDate } from "../../domain/dates";
import { dropIntoSection } from "../../domain/dropPatch";
import { buildInbox, sortNoDate, sortTodayTasks } from "../../domain/lists";
import { useFrozenOrder } from "./useFrozenOrder";
import { ShownWhileDragging } from "./dnd/ShownWhileDragging";
import { SortableTaskList } from "./dnd/SortableTaskList";
import { TaskDndScope } from "./dnd/TaskDndScope";
import { SortMenu } from "./SortMenu";
import { useMoveToProject, useReceiveDrop } from "./useCrossDrop";
import { useDropReorder } from "./useDropReorder";
import { useSortByRules } from "./useSortByRules";
import type { SortMode } from "../../domain/order";
import { useSortMode } from "./useSortMode";
import { nextUp } from "../../domain/progress";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";
import { ScreenHeader } from "../shell/ScreenHeader";
import { TASK_COLUMN_CLASS } from "../tasks/layout";
import { ProgressSummary } from "../tasks/ProgressSummary";
import { useTaskStore } from "../tasks/store";
import { TaskRow, type RowDrag } from "../tasks/TaskRow";
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
  const [openOverdue, setOpenOverdue] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("agendal:inbox:open:overdue");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });
  const [openToday, setOpenToday] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("agendal:inbox:open:today");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });
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

  const handleToggleOverdue = (next: boolean) => {
    setOpenOverdue(next);
    try {
      sessionStorage.setItem("agendal:inbox:open:overdue", String(next));
    } catch {}
  };

  const handleToggleToday = (next: boolean) => {
    setOpenToday(next);
    try {
      sessionStorage.setItem("agendal:inbox:open:today", String(next));
    } catch {}
  };

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
  const frozen = useFrozenOrder(store.tasks, selectedTaskId);
  const [todayMode, setTodayMode] = useSortMode("today");
  const [noDateMode, setNoDateMode] = useSortMode("no_date");
  const inboxMode: SortMode = todayMode;
  const setInboxMode = (next: SortMode) => {
    setTodayMode(next);
    setNoDateMode(next);
  };
  const sortTodayByRules = useSortByRules("today", "day_order");
  const sortNoDateByRules = useSortByRules("no_date", "project_order");
  const sortInboxByRules = () => {
    sortTodayByRules(
      sortTodayTasks(
        view.today.filter((x) => !x.done),
        store.today,
      ),
    );
    sortNoDateByRules(sortNoDate(view.noDate.filter((x) => !x.done)));
  };
  const moveInToday = useDropReorder("today", "day_order");
  const moveInNoDate = useDropReorder("no_date", "project_order");
  const moveInCompleted = useDropReorder("completed", "project_order");
  // Into another section (Spec 02 §3): the dates change, and a frozen row is let go
  const receiveInToday = useReceiveDrop(
    "day_order",
    dropIntoSection("today", store.today),
    frozen.release,
  );
  const receiveInNoDate = useReceiveDrop(
    "project_order",
    dropIntoSection("no_date", store.today),
    frozen.release,
  );
  const receiveInCompleted = useReceiveDrop(
    "project_order",
    dropIntoSection("completed", store.today),
    frozen.release,
  );
  const moveToProject = useMoveToProject();
  const view = buildInbox(frozen.layout, store.today, {
    sort: { today: todayMode, noDate: noDateMode },
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
    opts: { overdue?: boolean; drag?: RowDrag } = {},
  ) => (
    <TaskRow
      key={task.id}
      task={frozen.live(task)}
      project={store.projectOf(frozen.live(task))}
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
    <TaskDndScope>
      <div className="pb-8">
        {showHeader && (
          <ScreenHeader
            overline={formatLongDate(store.today)}
            title={t("nav.inbox")}
            accountInitial={accountInitial}
            navigate={navigate}
            action={
              <SortMenu
                mode={inboxMode}
                onModeChange={setInboxMode}
                listName={t("nav.inbox")}
                onSortByRules={sortInboxByRules}
              />
            }
          />
        )}

        {view.empty ? (
          <section className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <h2 className="m-0 text-dialog font-semibold text-balance focus:outline-none">
              {t("list.first_run")}
            </h2>
          </section>
        ) : (
          <div className="w-full">
            {!showHeader && !view.empty && (
              <div
                className={cx(
                  TASK_COLUMN_CLASS,
                  "mb-4 flex items-center justify-end",
                )}
              >
                <SortMenu
                  mode={inboxMode}
                  onModeChange={setInboxMode}
                  listName={t("nav.inbox")}
                  onSortByRules={sortInboxByRules}
                />
              </div>
            )}
            {!allDone && (
              <div className={TASK_COLUMN_CLASS}>
                <ProgressSummary
                  progress={view.progress}
                  next={nextUp(
                    [...view.today, ...view.overdue].filter((x) => !x.done),
                    store.today,
                  )}
                  timeFormat={store.timeFormat}
                />
              </div>
            )}
            {allDone && (
              <section className="flex w-full flex-col items-center justify-center gap-2 px-5 py-8 text-center">
                <span className="text-ink-tertiary" aria-hidden="true">
                  <CheckIcon size={28} />
                </span>
                <h2
                  ref={doneHeading}
                  tabIndex={-1}
                  className="m-0 text-dialog font-semibold text-balance focus:outline-none"
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
                  <span className="link-swipe">{t("list.see_upcoming")}</span>
                </Link>
              </section>
            )}
            <div className={TASK_COLUMN_CLASS}>
              {view.overdue.length > 0 && (
                <Section
                  title={t("list.overdue")}
                  count={view.overdue.length}
                  tone="danger"
                  collapsible
                  open={openOverdue}
                  onToggle={handleToggleOverdue}
                >
                  {/* A source only: Overdue keeps its date order and takes no drops */}
                  <SortableTaskList
                    list="overdue"
                    tasks={view.overdue}
                    onMove={() => {}}
                    onToProject={moveToProject}
                  >
                    {(x, drag) => row(x, { overdue: true, drag })}
                  </SortableTaskList>
                </Section>
              )}
              <ShownWhileDragging shown={view.today.length > 0}>
                <Section
                  title={t("list.today")}
                  count={view.today.length}
                  collapsible
                  open={openToday}
                  onToggle={handleToggleToday}
                >
                  <SortableTaskList
                    list="today"
                    tasks={view.today}
                    onMove={(id, to) => moveInToday(view.today, id, to)}
                    onReceive={(drop) => receiveInToday(view.today, drop)}
                    onToProject={moveToProject}
                  >
                    {(x, drag) => row(x, { drag })}
                  </SortableTaskList>
                </Section>
              </ShownWhileDragging>
              <ShownWhileDragging shown={view.noDate.length > 0}>
                <Section
                  title={t("list.no_date")}
                  count={view.noDate.length}
                  collapsible
                  open={openNoDate}
                  onToggle={handleToggleNoDate}
                >
                  <SortableTaskList
                    list="no_date"
                    tasks={view.noDate}
                    onMove={(id, to) => moveInNoDate(view.noDate, id, to)}
                    onReceive={(drop) => receiveInNoDate(view.noDate, drop)}
                    onToProject={moveToProject}
                  >
                    {(x, drag) => row(x, { drag })}
                  </SortableTaskList>
                </Section>
              </ShownWhileDragging>
              {view.completed.length > 0 && (
                <Section
                  title={t("list.completed")}
                  count={view.completed.length}
                  collapsible
                  open={openCompleted}
                  onToggle={handleToggleCompleted}
                  footer={
                    hasHiddenCompleted ? (
                      <TextButton
                        className="mt-1 w-full"
                        onClick={() => setShowAllCompleted(true)}
                      >
                        {t("list.show_all")}
                      </TextButton>
                    ) : showAllCompleted &&
                      INBOX_COMPLETED_PAGE < totalCompleted ? (
                      <TextButton
                        className="mt-1 w-full"
                        onClick={() => setShowAllCompleted(false)}
                      >
                        {t("list.show_less")}
                      </TextButton>
                    ) : null
                  }
                >
                  {visibleCompleted.length > 0 && (
                    <SortableTaskList
                      list="completed"
                      tasks={visibleCompleted}
                      onMove={(id, to) => moveInCompleted(visibleCompleted, id, to)}
                      onReceive={(drop) => receiveInCompleted(visibleCompleted, drop)}
                      onToProject={moveToProject}
                    >
                      {(x, drag) => row(x, { drag })}
                    </SortableTaskList>
                  )}
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </TaskDndScope>
  );
}
