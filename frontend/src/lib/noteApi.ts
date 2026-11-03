import { api } from "./api";
import { ApiRequestError, handleResponse } from "./apiError";
import { now, timeZone } from "./clock";
import { isCopyKey, type CopyKey } from "../ui/copy";
import type { TaskApi, TaskPatch } from "../ui/domain/api";
import type { NoteResult } from "../ui/domain/types";

/** Why a note wasn't made: the copy to show, and for 429 the seconds until it may be sent again. */
export interface NoteSubmitFailure {
  error: CopyKey;
  retryAfter?: number;
}

/** What sending a note answers: the result, or why it wasn't made. */
export type NoteSubmission = Promise<NoteResult | NoteSubmitFailure>;

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
    if (response.status === 409) {
      const data = await response
        .clone()
        .json()
        .catch(() => null);
      if (data?.error?.code === "note.undo_conflicts")
        return { conflicts: data.error.tasks?.length ?? 1 };
    }
    const result = await handleResponse<NoteResult>(response);
    rememberNote(result);
    return { result };
  } catch (error) {
    if (!(error instanceof ApiRequestError))
      return { error: "note.needs_connection" };
    return { error: isCopyKey(error.code) ? error.code : "error.generic" };
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
}

/** The result of a note made in this session, or undefined (a deep link, a reload). */
export function recallNote(id: string): NoteResult | undefined {
  return recent.get(id);
}

/** Drops the kept results: sign-out leaves nothing of the account in memory (SC-19). */
export function forgetNotes() {
  recent.clear();
}

/** `GET /notes/{id}` (RV §7): `404` for a note that isn't the user's. */
export async function getNote(id: string): Promise<NoteResult> {
  return handleResponse<NoteResult>(
    await api(`/notes/${encodeURIComponent(id)}`),
  );
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

/** IM-46 edits a follow-up in place; editing applied notes remains IM-47. */
export async function replanFollowup(id: string, text: string): NoteSubmission {
  try {
    const result = await handleResponse<NoteResult>(
      await api(`/notes/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, timezone: timeZone() }),
      }),
    );
    rememberNote(result);
    return result;
  } catch (error) {
    return submitFailure(error);
  }
}

/**
 * Apply changes and Edit note on Check this first: `POST /notes/{id}/apply` · `/cancel` (RV §7). The
 * note as it is now, or the copy saying why not. A network failure reads as "needs a connection".
 */
export async function confirmNote(
  id: string,
  action: "apply" | "cancel",
  edits: Record<string, TaskPatch> = {},
): Promise<NoteResult | { error: CopyKey }> {
  try {
    const result = await handleResponse<NoteResult>(
      await api(`/notes/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "apply" ? { edits } : {}),
      }),
    );
    rememberNote(result);
    return result;
  } catch (error) {
    if (!(error instanceof ApiRequestError))
      return { error: "note.needs_connection" };
    return { error: isCopyKey(error.code) ? error.code : "error.generic" };
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
      if (ref) edits[ref] = { ...edits[ref], ...fields };
      return task;
    },
    complete: refuse,
    reopen: refuse,
  };
  return { api, edits };
}
