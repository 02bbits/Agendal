import { api } from "./api";
import { ApiRequestError, handleResponse } from "./apiError";
import { now, timeZone } from "./clock";
import { isCopyKey, type CopyKey } from "../ui/copy";
import type { NoteChange, NoteResult } from "../ui/domain/types";

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
  // ponytail: answers from the IM-02 fixture until IM-37's endpoint exists; remove with the flag
  if (process.env.NEXT_PUBLIC_NOTES_MOCK === "1")
    return mockNote(text, clientId);
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
    if (!(error instanceof ApiRequestError))
      return { error: "note.send_failed" };
    if (error.status === 429)
      return {
        error: "error.rate_limited",
        retryAfter: error.retryAfter ?? 60,
      };
    if (error.status === 422)
      return { error: isCopyKey(error.code) ? error.code : "error.invalid" };
    // 5xx, 503, 401, 419 and 404 (no endpoint yet) all read as "couldn't send, try again"
    return { error: "note.send_failed" };
  }
}

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
  // ponytail: the same fixture as submitNote until IM-37; remove with the flag
  if (process.env.NEXT_PUBLIC_NOTES_MOCK === "1") return mockResult(id);
  return handleResponse<NoteResult>(
    await api(`/notes/${encodeURIComponent(id)}`),
  );
}

// ponytail: stands in for IM-37. The fixture's tasks are made for real through POST /tasks (the
// ids are fixed, so a repeat is a replay), one extra task has no date so the When? chips show.
// Projects are left out: the fixture's project ids don't exist
const UNDATED: NoteChange = {
  kind: "created",
  label: "No date",
  task: {
    id: "019a1c00-0000-7000-8000-000000000203",
    title: "Buy printer ink",
    due_date: null,
    start_time: null,
    end_time: null,
    priority: "low",
    project_id: null,
    repeat: "never",
    reminder: "none",
    notes: null,
    done: false,
    done_at: null,
    created_by: "assistant",
    created_at: "2026-10-23T08:12:00+07:00",
  },
};

async function mockResult(id?: string): Promise<NoteResult> {
  const { default: done } =
    await import("../../../docs/07-architecture/contracts/fixtures/note-result-done.json");
  const result = {
    ...done,
    note: { ...done.note, ...(id && { id }) },
    changes: [...done.changes, UNDATED],
  } as NoteResult;
  for (const { task } of result.changes) {
    await api("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        start_time: task.start_time,
        end_time: task.end_time,
        priority: task.priority,
        reminder: task.reminder,
        repeat: task.repeat,
        project_id: null,
      }),
    });
  }
  return result;
}

async function mockNote(text: string, clientId: string): Promise<NoteResult> {
  const result = await mockResult();
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { ...result, note: { ...result.note, client_id: clientId, text } };
}
