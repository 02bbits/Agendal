import { api } from "./api";
import { ApiRequestError, handleResponse } from "./apiError";
import { now, timeZone } from "./clock";
import { isCopyKey, type CopyKey } from "../ui/copy";
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

async function mockNote(text: string, clientId: string): Promise<NoteResult> {
  const { default: done } =
    await import("../../../docs/07-architecture/contracts/fixtures/note-result-done.json");
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    ...done,
    note: { ...done.note, client_id: clientId, text },
  } as NoteResult;
}
