import { api } from "./api";
import { ApiRequestError } from "./apiError";
import type { TaskApi } from "../ui/domain/api";
import type { Task } from "../ui/domain/types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorCode: string | undefined;
    let requestId: string | undefined;
    try {
      const data = await response.json();
      errorCode = data?.error?.code;
      requestId = data?.error?.request_id;
    } catch {
      // Body is not JSON
    }
    throw new ApiRequestError(
      errorCode ?? "error.generic",
      response.status,
      requestId,
    );
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

export const httpTaskApi: TaskApi = {
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }> {
    return postLifecycle(id, "complete", at);
  },

  reopen(id: string, at: string): Promise<{ task: Task; next?: Task }> {
    return postLifecycle(id, "reopen", at);
  },
};
