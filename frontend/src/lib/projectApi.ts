import { api } from "./api";
import { handleResponse } from "./apiError";
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

/** `GET /projects` */
export async function listProjects(): Promise<Project[]> {
  const response = await api("/projects");
  return handleResponse<Project[]>(response);
}

/** `POST /projects` */
export async function createProject(body: CreateProjectBody): Promise<Project> {
  const response = await api("/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<Project>(response);
}

/** `GET /projects/{id}` */
export async function getProject(
  id: string,
  cursor?: string | null,
): Promise<ProjectDetailResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await api(`/projects/${encodeURIComponent(id)}${query}`);
  return handleResponse<ProjectDetailResponse>(response);
}

/** `PATCH /projects/{id}` */
export async function updateProject(
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
  return handleResponse<Project>(response);
}

/** `DELETE /projects/{id}?tasks=move|delete` */
export async function deleteProject(
  id: string,
  mode?: "move" | "delete",
): Promise<DeleteProjectResponse> {
  const query = mode ? `?tasks=${encodeURIComponent(mode)}` : "";
  const response = await api(`/projects/${encodeURIComponent(id)}${query}`, {
    method: "DELETE",
  });
  return handleResponse<DeleteProjectResponse>(response);
}

/** `POST /projects/{id}/restore` */
export async function restoreProject(
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
  return handleResponse<Project>(response);
}
