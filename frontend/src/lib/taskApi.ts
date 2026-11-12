import { api } from "./api";
import { handleResponse } from "./apiError";
import { putTasks, removeTasks, replaceProjects } from "./localStore";
import type { DeleteScope, TaskApi, TaskPatch } from "../ui/domain/api";
import type { CreateTaskBody } from "../ui/domain/newTask";
import type { SearchFilter } from "../ui/domain/search";
import type { Project, Task } from "../ui/domain/types";

// Every answer that carries tasks or projects also lands in the device store (IM-51), without
// waiting for it: the store is a copy, and a failed write mustn't fail the call
function keep(task: Task): Task {
  void putTasks([task]);
  return task;
}

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

  const result = await handleResponse<T & { task: Task; next?: Task }>(
    response,
  );
  void putTasks([result?.task, result?.next]);
  return result;
}

export async function inbox(): Promise<InboxData> {
  const response = await api("/tasks?view=inbox");
  const data = await handleResponse<InboxData>(response);
  void putTasks([
    ...(data?.overdue ?? []),
    ...(data?.today ?? []),
    ...(data?.no_date ?? []),
    ...(data?.completed_today ?? []),
  ]);
  return data;
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
  const data = await handleResponse<UpcomingData>(response);
  void putTasks((data?.days ?? []).flatMap((day) => day.tasks));
  return data;
}

export async function search(params: {
  q?: string;
  status?: "all" | "open" | "completed";
  cursor?: string;
  filter?: SearchFilter;
  project_id?: string;
}): Promise<SearchData> {
  const query = new URLSearchParams();
  if (params.q !== undefined && params.q !== "") query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.filter) query.set("filter", params.filter);
  if (params.project_id) query.set("project_id", params.project_id);
  const response = await api(`/tasks/search?${query.toString()}`);
  const data = await handleResponse<SearchData>(response);
  void putTasks(data?.items ?? []);
  return data;
}

export async function getTask(id: string): Promise<Task> {
  const response = await api(`/tasks/${encodeURIComponent(id)}`);
  return keep(await handleResponse<Task>(response));
}

export async function projects(): Promise<Project[]> {
  const response = await api("/projects");
  const list = await handleResponse<Project[]>(response);
  if (Array.isArray(list)) void replaceProjects(list);
  return list;
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

  return keep(await handleResponse<Task>(response));
}

export async function createTask(body: CreateTaskBody): Promise<Task> {
  const response = await api("/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return keep(await handleResponse<Task>(response));
}

export async function deleteTask(
  id: string,
  scope?: DeleteScope,
): Promise<{ next?: Task } | void> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  const response = await api(`/tasks/${encodeURIComponent(id)}${query}`, {
    method: "DELETE",
  });
  const result = await handleResponse<{ next?: Task } | void>(response);
  void removeTasks([id]);
  if (result?.next) void putTasks([result.next]);
  return result;
}

export async function restoreTask(id: string): Promise<Task> {
  const response = await api(`/tasks/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
  return keep(await handleResponse<Task>(response));
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

  get(id: string): Promise<Task> {
    return getTask(id);
  },

  search(params: {
    q?: string;
    status?: "all" | "open" | "completed";
    cursor?: string;
    filter?: SearchFilter;
    project_id?: string;
  }): Promise<SearchData> {
    return search(params);
  },
};
