import { api } from "./api";
import { handleResponse } from "./apiError";
import type { DeleteScope, TaskApi, TaskPatch } from "../ui/domain/api";
import type { CreateTaskBody } from "../ui/domain/newTask";
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

export interface UpcomingDay {
  date: string;
  tasks: Task[];
}

export interface UpcomingData {
  days: UpcomingDay[];
  next_from: string | null;
  total_count?: number;
}

export interface SearchData {
  items: Task[];
  counts: {
    all: number;
    open: number;
    completed: number;
  };
  next_cursor: string | null;
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

export async function upcoming(params?: {
  from?: string;
  days?: number;
  filter?: "all" | "scheduled" | "due";
}): Promise<UpcomingData> {
  const query = new URLSearchParams({ view: "upcoming" });
  if (params?.from) query.set("from", params.from);
  if (params?.days !== undefined) query.set("days", String(params.days));
  if (params?.filter) query.set("filter", params.filter);
  const response = await api(`/tasks?${query.toString()}`);
  return handleResponse<UpcomingData>(response);
}

export async function search(params: {
  q: string;
  status?: "all" | "open" | "completed";
  cursor?: string;
}): Promise<SearchData> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.cursor) query.set("cursor", params.cursor);
  const response = await api(`/tasks/search?${query.toString()}`);
  return handleResponse<SearchData>(response);
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

export async function createTask(body: CreateTaskBody): Promise<Task> {
  const response = await api("/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse<Task>(response);
}

export async function deleteTask(
  id: string,
  scope?: DeleteScope,
): Promise<{ next?: Task } | void> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  const response = await api(`/tasks/${encodeURIComponent(id)}${query}`, {
    method: "DELETE",
  });
  return handleResponse<{ next?: Task } | void>(response);
}

export async function restoreTask(id: string): Promise<Task> {
  const response = await api(`/tasks/${encodeURIComponent(id)}/restore`, {
    method: "POST",
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

  remove(id: string, scope?: DeleteScope): Promise<{ next?: Task } | void> {
    return deleteTask(id, scope);
  },

  restore(id: string): Promise<Task> {
    return restoreTask(id);
  },

  search(params: {
    q: string;
    status?: "all" | "open" | "completed";
    cursor?: string;
  }): Promise<SearchData> {
    return search(params);
  },
};
