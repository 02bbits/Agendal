import { api } from "./api";
import { ApiRequestError, handleResponse } from "./apiError";
import { now, timeZone } from "./clock";
import {
  putNoteEntries,
  putNoteResult,
  readNoteEntries,
  removeNote,
} from "./localStore";
import { isCopyKey, type CopyKey } from "../ui/copy";
import type { TaskApi, TaskPatch } from "../ui/domain/api";
import type { NoteHit } from "../ui/domain/search";
import type { NoteResult, NoteListEntry, NoteFilter } from "../ui/domain/types";

/** Why a note wasn't made: the copy to show, and for 429 the seconds until it may be sent again. */
export interface NoteSubmitFailure {
  error: CopyKey;
  retryAfter?: number;
}

/** What sending a note answers: the result, or why it wasn't made. */
export type NoteSubmission = Promise<NoteResult | NoteSubmitFailure>;

/** What Edit note answers: also `{conflicts}` when tasks edited by hand need an answer first (RV-E16). */
export type NoteReplan = Promise<
  NoteResult | NoteSubmitFailure | { conflicts: number }
>;

/**
 * `POST /notes` (NC §2.2, NU §7). The same `client_id` on a retry returns the stored result, so a
 * double tap or a lost reply never makes two notes (NC-E10, NC-E11).
 */
export async function submitNote(
  text: string,
  clientId: string,
): NoteSubmission {
  try {
    return await handleResponse<NoteResult>(
      await api("/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          text,
          written_at: now().toISOString(),
          timezone: timeZone(),
        }),
      }),
    );
  } catch (error) {
    return submitFailure(error);
  }
}

function submitFailure(error: unknown): NoteSubmitFailure {
  if (!(error instanceof ApiRequestError)) return { error: "note.send_failed" };
  if (error.status === 429)
    return {
      error: "error.rate_limited",
      retryAfter: error.retryAfter ?? 60,
    };
  if (error.status === 422)
    return { error: isCopyKey(error.code) ? error.code : "error.invalid" };
  // 5xx, 503, 401, 419 and 404 all read as "couldn't send, try again"
  return { error: "note.send_failed" };
}

/** What Undo all and its redo answer: the note as it is now, how many tasks conflict, or why not. */
export type NoteActionOutcome =
  { result: NoteResult } | { conflicts: number } | { error: CopyKey };

/** A note action's failure as copy: the server's code when it has copy, "needs a connection" offline. */
function actionError(error: unknown): { error: CopyKey } {
  if (!(error instanceof ApiRequestError))
    return { error: "note.needs_connection" };
  return { error: isCopyKey(error.code) ? error.code : "error.generic" };
}

/** How many tasks a `409 note.undo_conflicts` names (RV §2.4), or 0 for any other answer. */
async function conflictCount(response: Response): Promise<number> {
  if (response.status !== 409) return 0;
  const data = await response
    .clone()
    .json()
    .catch(() => null);
  return data?.error?.code === "note.undo_conflicts"
    ? (data.error.tasks?.length ?? 1)
    : 0;
}

/**
 * `POST /notes/{id}/undo` and `/redo` (RV §7). A `409 note.undo_conflicts` isn't a failure: it
 * asks the user first (RV §2.4). A network failure reads as "needs a connection".
 */
async function noteAction(
  id: string,
  action: "undo" | "redo",
  body: object,
): Promise<NoteActionOutcome> {
  try {
    const response = await api(`/notes/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const conflicts = await conflictCount(response);
    if (conflicts) return { conflicts };
    const result = await handleResponse<NoteResult>(response);
    rememberNote(result);
    return { result };
  } catch (error) {
    return actionError(error);
  }
}

export const undoNote = (id: string, confirmConflicts: boolean) =>
  noteAction(id, "undo", { confirm_conflicts: confirmConflicts });

export const redoNote = (id: string) => noteAction(id, "redo", {});

// Results the user has just made, so the result screen opens at once instead of asking the
// server again (RV §3: a skeleton only on a deep link)
const recent = new Map<string, NoteResult>();

export function rememberNote(result: NoteResult) {
  recent.set(result.note.id, result);
  // Kept on the device too, so the note opens offline (IM-51)
  void putNoteResult(result);
}

/** The result of a note made in this session, or undefined (a deep link, a reload). */
export function recallNote(id: string): NoteResult | undefined {
  return recent.get(id);
}

/** A note was made, changed, deleted or restored: the Notes list and an open note load again. */
export const NOTE_UPDATED = "agendal:note-updated";
/** `id` names the note that changed: only its open screen loads again, others keep their review. */
export const notesChanged = (id?: string) =>
  window.dispatchEvent(new CustomEvent(NOTE_UPDATED, { detail: { id } }));
/** Whether a NOTE_UPDATED event concerns the note `id` (an event naming no note concerns every note). */
export const concernsNote = (event: Event, id: string) => {
  const changed = (event as CustomEvent<{ id?: string } | null>).detail?.id;
  return changed === undefined || changed === id;
};

/** Drops one kept result, e.g. a deleted note. */
export function forgetNote(id: string) {
  recent.delete(id);
}

/** Drops the kept results: sign-out leaves nothing of the account in memory (SC-19). */
export function forgetNotes() {
  recent.clear();
}

/** `GET /notes/{id}` (RV §7): `404` for a note that isn't the user's. */
export async function getNote(id: string): Promise<NoteResult> {
  const result = await handleResponse<NoteResult>(
    await api(`/notes/${encodeURIComponent(id)}`),
  );
  void putNoteResult(result);
  return result;
}

export interface NoteListPage {
  items: NoteListEntry[];
  next_cursor: string | null;
  total: number;
  needs_count: number;
}
export async function listNotes(
  filter: NoteFilter = "all",
  cursor?: string,
): Promise<NoteListPage> {
  const params = new URLSearchParams({ filter });
  if (cursor) params.set("cursor", cursor);
  const page = await handleResponse<NoteListPage>(
    await api(`/notes?${params}`),
  );
  void putNoteEntries(page?.items ?? []);
  return page;
}

const NEEDS_LOOK: readonly string[] = ["confirm", "followup", "pending"];

/**
 * The Notes list from the device (IM-51), shaped like `GET /notes`: all of it in one page, or
 * null when it holds no notes.
 */
export async function deviceNotes(
  filter: NoteFilter,
): Promise<NoteListPage | null> {
  const all = await readNoteEntries();
  if (all.length === 0) return null;
  const needs = all.filter((note) => NEEDS_LOOK.includes(note.status));
  const items =
    filter === "made"
      ? all.filter((note) => note.status === "done")
      : filter === "needs"
        ? needs
        : all;
  return {
    items,
    next_cursor: null,
    total: all.length,
    needs_count: needs.length,
  };
}

/** RV-3: explicitly keep a follow-up's whole text as one task. */
export async function makeFollowupTask(
  id: string,
): Promise<NoteResult | { error: CopyKey }> {
  try {
    const result = await handleResponse<NoteResult>(
      await api(`/notes/${encodeURIComponent(id)}/make-task`, {
        method: "POST",
      }),
    );
    rememberNote(result);
    return result;
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError && isCopyKey(error.code)
          ? error.code
          : "note.needs_connection",
    };
  }
}

/** The user renames a note (`PATCH /notes/{id}`): the note as it is now, or the copy saying why not. */
export async function renameNote(
  id: string,
  name: string,
): Promise<NoteResult | { error: CopyKey }> {
  try {
    const result = await handleResponse<NoteResult>(
      await api(`/notes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    );
    rememberNote(result);
    return result;
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError && isCopyKey(error.code)
          ? error.code
          : "error.save_failed",
    };
  }
}

/**
 * Edit note (RV-5): `PUT /notes/{id}` re-plans the same note. A `done` note first undoes what it
 * applied, so tasks edited by hand since answer `{conflicts}` to ask first (RV-E16).
 */
export async function replanNote(
  id: string,
  text: string,
  confirmConflicts = false,
): NoteReplan {
  try {
    const response = await api(`/notes/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        timezone: timeZone(),
        confirm_conflicts: confirmConflicts,
      }),
    });
    const conflicts = await conflictCount(response);
    if (conflicts) return { conflicts };
    const result = await handleResponse<NoteResult>(response);
    rememberNote(result);
    return result;
  } catch (error) {
    return submitFailure(error);
  }
}

/** `GET /notes/search?q=`: search note names and text. */
export async function searchNotes(q: string): Promise<{ items: NoteHit[] }> {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  const response = await api(`/notes/search?${query.toString()}`);
  return handleResponse<{ items: NoteHit[] }>(response);
}

/**
 * Apply changes and Edit note on Check this first: `POST /notes/{id}/apply` (RV §7). The
 * note as it is now, or the copy saying why not. A network failure reads as "needs a connection".
 */
export async function confirmNote(
  note: Pick<NoteResult["note"], "id" | "plan_version">,
  edits: Record<string, TaskPatch> = {},
  exclude: string[] = [],
): Promise<NoteResult | { error: CopyKey }> {
  try {
    const result = await handleResponse<NoteResult>(
      await api(`/notes/${encodeURIComponent(note.id)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `plan_version` names the reviewed plan: one made since answers 409 note.plan_changed, and a
        // repeat of an apply that already landed answers with the note as it is
        body: JSON.stringify({
          edits,
          plan_version: note.plan_version,
          ...(exclude.length ? { exclude } : {}),
        }),
      }),
    );
    rememberNote(result);
    return result;
  } catch (error) {
    // The note isn't the one this screen showed: what this session kept of it is stale too
    if (
      error instanceof ApiRequestError &&
      (error.code === "note.plan_changed" || error.code === "note.wrong_status")
    )
      forgetNote(note.id);
    return actionError(error);
  }
}

/**
 * Check this first's tasks don't exist yet (NU-5). Task details edits them through this instead of
 * the server, and Apply sends what changed, by plan entry ref. Completing one isn't a planned change.
 */
export function previewTaskApi(result: NoteResult) {
  const tasks = new Map(result.changes.map((c) => [c.task.id, c.task]));
  const refs = new Map(result.changes.map((c) => [c.task.id, c.ref]));
  const edits: Record<string, TaskPatch> = {};
  const refuse = () => Promise.reject(new Error("note.preview"));
  const api: TaskApi = {
    async patch(id, fields) {
      const task = { ...tasks.get(id)!, ...fields };
      tasks.set(id, task);
      const ref = refs.get(id);
      // A new due date goes with the start date shown beside it: the server would otherwise derive
      // the start from the plan, which can differ from what this screen showed
      const shown =
        "due_date" in fields && task.start_date !== null
          ? { start_date: task.start_date }
          : {};
      if (ref) edits[ref] = { ...edits[ref], ...shown, ...fields };
      return task;
    },
    complete: refuse,
    reopen: refuse,
    remove: refuse,
    restore: refuse,
  };
  return { api, edits };
}

/**
 * `DELETE /notes/{id}`: deletes a note. Undo on the toast brings it back with `restoreNote`.
 */
export async function deleteNote(
  id: string,
): Promise<true | { error: CopyKey }> {
  try {
    const response = await api(`/notes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    // 204 has no body to read; a failure throws with the server's code
    if (!response.ok) await handleResponse(response);
    forgetNote(id);
    void removeNote(id);
    return true;
  } catch (error) {
    return actionError(error);
  }
}

/** `POST /notes/{id}/restore` (RV §7): the Undo of a deleted note; the note as it was. */
export async function restoreNote(
  id: string,
): Promise<NoteResult | { error: CopyKey }> {
  try {
    const result = await handleResponse<NoteResult>(
      await api(`/notes/${encodeURIComponent(id)}/restore`, { method: "POST" }),
    );
    rememberNote(result);
    return result;
  } catch (error) {
    return actionError(error);
  }
}
