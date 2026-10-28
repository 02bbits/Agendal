import { useState } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/ChipGroup";
import { EmptyState } from "../../components/EmptyState";
import { CalendarIcon, ClockIcon } from "../../components/icons";
import { addDays, formatDay } from "../../domain/dates";
import {
  upcomingPage,
  type UpcomingFilter,
  type UpcomingPage,
} from "../../domain/lists";
import type { Navigate } from "../shell/routes";
import { ScreenHeader } from "../shell/ScreenHeader";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";
import { Section } from "./Section";

const FILTER_KEY = "agendal.upcoming.filter";

/** The filter is remembered per device (LV §2.2); storage may be unavailable, so every access is guarded. */
function readFilter(): UpcomingFilter {
  try {
    const saved = localStorage.getItem(FILTER_KEY);
    return saved === "scheduled" || saved === "due" ? saved : "all";
  } catch {
    return "all";
  }
}
function writeFilter(filter: UpcomingFilter) {
  try {
    localStorage.setItem(FILTER_KEY, filter);
  } catch {
    /* per-device convenience only */
  }
}

export interface UpcomingScreenProps {
  accountInitial: string;
  navigate?: Navigate;
}

/** Upcoming (LV-2): from tomorrow, grouped by day, 14 days at a time, All / Scheduled / Due only. */
export function UpcomingScreen({
  accountInitial,
  navigate,
}: UpcomingScreenProps) {
  const store = useTaskStore();
  const [filter, setFilter] = useState<UpcomingFilter>(readFilter);
  const [pages, setPages] = useState(1);
  const tomorrow = addDays(store.today, 1);

  const loaded: UpcomingPage = { days: [], nextFrom: tomorrow };
  for (let i = 0; i < pages && loaded.nextFrom; i++) {
    const page = upcomingPage(
      store.tasks,
      loaded.nextFrom,
      filter,
      14,
      store.isSettling,
    );
    loaded.days.push(...page.days);
    loaded.nextFrom = page.nextFrom;
  }
  const anyUnfiltered =
    filter !== "all" &&
    upcomingPage(store.tasks, tomorrow, "all").days.length > 0;

  const choose = (next: UpcomingFilter) => {
    setFilter(next);
    setPages(1);
    writeFilter(next);
  };
  const [filterEmptyText, showAllLabel] =
    t("list.filter_empty").split(/(?<=\.)\s+/);

  return (
    <div className="pb-8">
      <ScreenHeader
        overline={t("list.from_tomorrow")}
        title={t("nav.upcoming")}
        accountInitial={accountInitial}
        navigate={navigate}
      >
        <div className="mt-4">
          <ChipGroup
            label={t("list.filter_label")}
            value={filter}
            onChange={choose}
            options={[
              { value: "all", label: t("list.filter_all") },
              {
                value: "scheduled",
                label: t("list.filter_scheduled"),
                icon: <ClockIcon size={14} />,
              },
              {
                value: "due",
                label: t("list.filter_due"),
                icon: <CalendarIcon size={14} />,
              },
            ]}
          />
        </div>
      </ScreenHeader>

      {loaded.days.length === 0 ? (
        anyUnfiltered ? (
          <section className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <h2 className="m-0 font-serif text-dialog font-semibold text-balance focus:outline-none">
              {filterEmptyText}
            </h2>
            <button
              type="button"
              className="focus-ring min-h-11 cursor-pointer rounded-tile border-0 bg-transparent px-2 text-callout font-semibold text-primary"
              onClick={() => choose("all")}
            >
              {showAllLabel}
            </button>
          </section>
        ) : (
          <EmptyState title={t("list.upcoming_empty")} />
        )
      ) : (
        <>
          {loaded.days.map((day) => (
            <Section
              key={day.date}
              title={formatDay(day.date, store.today)}
              count={day.tasks.length}
            >
              {day.tasks.map((x) => (
                <TaskRow
                  key={x.id}
                  task={x}
                  project={store.projectOf(x)}
                  today={store.today}
                  timeFormat={store.timeFormat}
                  onToggle={store.toggle}
                  navigate={navigate}
                />
              ))}
            </Section>
          ))}
          {loaded.nextFrom && (
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => setPages((n) => n + 1)}
            >
              {t("list.load_more")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
