import type { ReactNode } from "react";
import { Toast } from "../../src/ui/components/Toast";
import { createMemoryApi } from "./memoryApi";
import type { Task } from "../../src/ui/domain/types";
import {
  TaskStoreProvider,
  useTaskStore,
  type Clock,
} from "../../src/ui/features/tasks/store";
import { TODAY, projects } from "./fixtures";

/** Friday 23 October 2026, 08:12 in Ho Chi Minh City. */
export const clock: Clock = {
  now: () => new Date("2026-10-23T01:12:00Z"),
  timeZone: "Asia/Ho_Chi_Minh",
};
export { TODAY };

function StoreToast() {
  const { toast, dismissToast } = useTaskStore();
  return <Toast toast={toast} onDismiss={dismissToast} />;
}

export function setup(tasks: Task[]) {
  const memory = createMemoryApi({ tasks, projects });
  const wrap = (ui: ReactNode) => (
    <TaskStoreProvider
      api={memory.api}
      clock={clock}
      initialTasks={tasks}
      initialProjects={projects}
    >
      <main>{ui}</main>
      <StoreToast />
    </TaskStoreProvider>
  );
  return { memory, wrap };
}
