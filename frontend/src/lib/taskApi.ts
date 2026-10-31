import { api } from "./api";
import { ApiRequestError } from "./apiError";
import type { TaskApi, TaskPatch } from "../ui/domain/api";
import type { Project, Task } from "../ui/domain/types";

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
    throw new ApiRequestError(errorCode || "error.generic", requestId);
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

export async function getTask(id: string): Promise<Task> {
  const response = await api(`/tasks/${encodeURIComponent(id)}`);
  return handleResponse<Task>(response);
}

export async function projects(): Promise<Project[]> {
  const response = await api("/projects");
  return handleResponse<Project[]>(response);
}

export async function patch(
  id: string,
  fields: TaskPatch,
  at: string,
): Promise<Task> {
  const response = await api(`/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...fields, at }),
  });

  return handleResponse<Task>(response);
}

export const httpTaskApi: TaskApi = {
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }> {
    return postLifecycle(id, "complete", at);
  },

  reopen(id: string, at: string): Promise<{ task: Task; next?: Task }> {
    return postLifecycle(id, "reopen", at);
  },

  patch(id: string, fields: TaskPatch, at: string): Promise<Task> {
    return patch(id, fields, at);
  },
};
