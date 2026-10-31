import type { ReactNode } from "react";
import { Toast } from "../../src/ui/components/Toast";
import { createMemoryApi, deferredApi } from "./memoryApi";
import type { TaskApi } from "../../src/ui/domain/api";
import type { Task } from "../../src/ui/domain/types";
import {
  TaskStoreProvider,
  useTaskStore,
} from "../../src/ui/features/tasks/store";
import type { Clock } from "../../src/ui/features/tasks/types";
import { TODAY, projects } from "./fixtures";

/** Friday 23 October 2026, 08:12 in Ho Chi Minh City. */
export const clock: Clock = {
  now: () => new Date("2026-10-23T01:12:00Z"),
  timeZone: "Asia/Ho_Chi_Minh",
};
export { TODAY, deferredApi };

function StoreToast() {
  const { toast, dismissToast } = useTaskStore();
  return <Toast toast={toast} onDismiss={dismissToast} />;
}

export function setup(tasks: Task[], customApi?: TaskApi) {
  const memory = createMemoryApi({ tasks, projects });
  const api = customApi ?? memory.api;
  const wrap = (ui: ReactNode) => (
    <TaskStoreProvider
      api={api}
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
