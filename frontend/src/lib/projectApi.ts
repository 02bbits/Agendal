import { api } from "./api";
import { handleResponse } from "./apiError";
import {
  putProject,
  putTasks,
  readProject,
  readTasks,
  removeProject,
  removeTasks,
  replaceProjects,
} from "./localStore";
import { offlineProject, orQueue } from "./offline";
import { orDevice } from "./taskApi";
import type { Project, ProjectColor, Task } from "../ui/domain/types";

export interface ProjectListResponse {
  projects: Project[];
}

export interface ProjectDetailResponse {
  project: Project & { open: number; done: number };
  progress: { done: number; total: number };
  open: Task[];
  completed: Task[];
  next_cursor: string | null;
}

export interface CreateProjectBody {
  id: string;
  name: string;
  colour: ProjectColor;
}

export interface UpdateProjectBody {
  name?: string;
  colour?: ProjectColor;
}

export interface DeleteProjectResponse {
  undo: {
    task_ids: string[];
    mode: "move" | "delete";
  };
}

export interface RestoreProjectBody {
  task_ids: string[];
  mode: "move" | "delete";
}

// Kept on the device too (IM-51); a failed store write never fails the call
function keep(project: Project): Project {
  if (project) void putProject(project);
  return project;
}

/** `GET /projects` */
export async function listProjects(): Promise<Project[]> {
  const response = await api("/projects");
  const list = await handleResponse<Project[]>(response);
  if (Array.isArray(list)) void replaceProjects(list);
  return list;
}

/** `POST /projects` */
export function createProject(body: CreateProjectBody) {
  const offline = offlineProject.create(body);
  return orQueue(() => sendCreate(body), offline.entries, offline.local);
}

async function sendCreate(body: CreateProjectBody): Promise<Project> {
  const response = await api("/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return keep(await handleResponse<Project>(response));
}

/** `GET /projects/{id}` */
export async function getProject(
  id: string,
  cursor?: string | null,
): Promise<ProjectDetailResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  try {
    const response = await api(`/projects/${encodeURIComponent(id)}${query}`);
    const detail = await handleResponse<ProjectDetailResponse>(response);
    void putTasks([...(detail?.open ?? []), ...(detail?.completed ?? [])]);
    return detail;
  } catch (error) {
    // A later page has nothing more on the device: it holds them all on the first
    if (cursor) throw error;
    return orDevice(() => deviceProject(id))(error);
  }
}

/** A project screen from the device copy: all its tasks, on one page. */
async function deviceProject(
  id: string,
): Promise<ProjectDetailResponse | undefined> {
  // "No project" has no row of its own: the screen names it when `project` is null
  const project = id === "none" ? null : await readProject(id);
  if (project === undefined) return undefined;
  const tasks = (await readTasks()).filter(
    (task) => (task.project_id ?? "none") === (project?.id ?? "none"),
  );
  const open = tasks
    .filter((task) => !task.done)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const completed = tasks
    .filter((task) => task.done)
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  return {
    project: project as ProjectDetailResponse["project"],
    progress: { done: completed.length, total: tasks.length },
    open,
    completed,
    next_cursor: null,
  };
}

/** `PATCH /projects/{id}` */
export function updateProject(id: string, body: UpdateProjectBody) {
  const offline = offlineProject.update(id, body);
  return orQueue(() => sendUpdate(id, body), offline.entries, offline.local);
}

async function sendUpdate(
  id: string,
  body: UpdateProjectBody,
): Promise<Project> {
  const response = await api(`/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return keep(await handleResponse<Project>(response));
}

/** `DELETE /projects/{id}?tasks=move|delete` */
export function deleteProject(id: string, mode?: "move" | "delete") {
  const offline = offlineProject.remove(id, mode);
  return orQueue<DeleteProjectResponse>(
    () => sendDelete(id, mode),
    offline.entries,
    offline.local,
  );
}

async function sendDelete(
  id: string,
  mode?: "move" | "delete",
): Promise<DeleteProjectResponse> {
  const query = mode ? `?tasks=${encodeURIComponent(mode)}` : "";
  const response = await api(`/projects/${encodeURIComponent(id)}${query}`, {
    method: "DELETE",
  });
  const result = await handleResponse<DeleteProjectResponse>(response);
  void removeProject(id);
  // Moved tasks change project on the server; refetched lists bring the new value
  if (result?.undo?.mode === "delete") void removeTasks(result.undo.task_ids);
  return result;
}

/** `POST /projects/{id}/restore` */
export function restoreProject(id: string, body: RestoreProjectBody) {
  const offline = offlineProject.restore(id, body.task_ids, body.mode);
  return orQueue(() => sendRestore(id, body), offline.entries, offline.local);
}

async function sendRestore(
  id: string,
  body: RestoreProjectBody,
): Promise<Project> {
  const response = await api(`/projects/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return keep(await handleResponse<Project>(response));
}
