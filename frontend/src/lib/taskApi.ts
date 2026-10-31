import { api } from "./api";
import type { TaskApi } from "../ui/domain/api";
import type { Task } from "../ui/domain/types";

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

export const httpTaskApi: TaskApi = {
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }> {
    return postLifecycle(id, "complete", at);
  },

  reopen(id: string, at: string): Promise<{ task: Task; next?: Task }> {
    return postLifecycle(id, "reopen", at);
  },
};
