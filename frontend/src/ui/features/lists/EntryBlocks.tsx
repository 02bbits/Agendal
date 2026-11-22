import type { ReactElement } from "react";
import { sortEntries, type DayEntry } from "../../domain/entries";
import type { Navigate } from "../shell/routes";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";
import { SortableTaskList } from "./dnd/SortableTaskList";
import { useDropReorder } from "./useDropReorder";
import { useSortMode } from "./useSortMode";

export interface EntryBlocksProps {
  entries: DayEntry[];
  /** The day these entries are on; its normal entries can be dragged (#178). */
  day: string;
  variant: "list" | "board";
  today: string;
  selectedTaskId?: string;
  navigate?: Navigate;
}

export function EntryBlocks({
  entries,
  day,
  variant,
  today,
  selectedTaskId,
  navigate,
}: EntryBlocksProps): ReactElement | null {
  const store = useTaskStore();
  const [mode] = useSortMode("upcoming");
  const { normal, due } = sortEntries(entries, mode);
  const move = useDropReorder("upcoming", "day_order");
  const normalTasks = normal.map((e) => e.task);

  if (normal.length === 0 && due.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {normal.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
          <ul className="m-0 list-none p-0">
            <SortableTaskList
              list={`day:${day}`}
              tasks={normalTasks}
              onMove={(id, to) => move(normalTasks, id, to)}
            >
              {(task, drag) => (
                <TaskRow
                  key={`${task.id}:start`}
                  drag={drag}
                  task={task}
                  entry="start"
                  project={store.projectOf(task)}
                  today={today}
                  timeFormat={store.timeFormat}
                  onToggle={store.toggle}
                  navigate={navigate}
                  selected={task.id === selectedTaskId}
                  settling={store.isSettling(task.id)}
                />
              )}
            </SortableTaskList>
          </ul>
        </div>
      )}

      {due.length > 0 &&
        (variant === "list" ? (
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-dashed border-due bg-due-tint">
            <ul className="m-0 list-none p-0">
              {due.map(({ task, kind }) => (
                <TaskRow
                  key={`${task.id}:${kind}`}
                  task={task}
                  entry={kind}
                  tone="due"
                  project={store.projectOf(task)}
                  today={today}
                  timeFormat={store.timeFormat}
                  onToggle={store.toggle}
                  navigate={navigate}
                  selected={task.id === selectedTaskId}
                  settling={store.isSettling(task.id)}
                />
              ))}
            </ul>
          </div>
        ) : (
          due.map(({ task, kind }) => (
            <div
              key={`${task.id}:${kind}`}
              className="overflow-hidden rounded-2xl border-[1.5px] border-dashed border-due bg-due-tint"
            >
              <ul className="m-0 list-none p-0">
                <TaskRow
                  task={task}
                  entry={kind}
                  tone="due"
                  project={store.projectOf(task)}
                  today={today}
                  timeFormat={store.timeFormat}
                  onToggle={store.toggle}
                  navigate={navigate}
                  selected={task.id === selectedTaskId}
                  settling={store.isSettling(task.id)}
                />
              </ul>
            </div>
          ))
        ))}
    </div>
  );
}
