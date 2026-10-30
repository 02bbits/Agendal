import { api } from "./api";
import type { TaskApi } from "../ui/domain/api";
import type { Project, Task } from "../ui/domain/types";

export interface InboxData {
  overdue: Task[];
  today: Task[];
  no_date: Task[];
  completed_today: Task[];
  progress: { done: number; total: number };
  no_date_count: number;
  completed_count: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorCode: string | undefined;
    try {
      const data = await response.json();
      errorCode = data?.error?.code;
    } catch {
      // Body is not JSON
    }
    throw new Error(errorCode || "error.generic");
  }

  return response.json();
}

async function postLifecycle<T>(
  id: string,
  action: "complete" | "reopen",
  at: string,
): Promise<T> {
  const response = await api(`/tasks/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ at }),
  });

  return handleResponse<T>(response);
}

export async function inbox(): Promise<InboxData> {
  const response = await api("/tasks?view=inbox");
  return handleResponse<InboxData>(response);
}

export async function projects(): Promise<Project[]> {
  const response = await api("/projects");
  return handleResponse<Project[]>(response);
}

export const httpTaskApi: TaskApi = {
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }> {
    return postLifecycle(id, "complete", at);
  },

  reopen(
    id: string,
    at: string,
  ): Promise<{ task: Task; removedNextId?: string }> {
    return postLifecycle(id, "reopen", at);
  },
};
