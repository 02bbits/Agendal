import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame, useAppFrame } from "../../src/app/AppFrame";
import { forgetNotes, recallNote } from "../../src/lib/noteApi";
import { type NoteResult } from "../../src/ui";
import { task } from "../ui/fixtures";

// IM-43: what a finished submit does. `done` opens the result; the other statuses have no screen yet
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => router,
}));
vi.mock("../../src/lib/draft", () => ({
  loadDraft: vi.fn().mockResolvedValue(""),
  saveDraft: vi.fn().mockResolvedValue(undefined),
  clearDraft: vi.fn().mockResolvedValue(undefined),
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const result = (status: NoteResult["note"]["status"]): NoteResult => ({
  note: {
    id: "n7",
    client_id: "c1",
    status,
    name: "This week",
    text: "call mum",
    source_file_name: null,
    written_at: "2026-10-23T08:12:00+07:00",
    processed_at: "2026-10-23T08:12:01+07:00",
  },
  changes:
    status === "done"
      ? [
          {
            kind: "created",
            label: "No date",
            task: task({ title: "Call mum" }),
          },
        ]
      : [],
  skipped: [],
});

function Opener() {
  return <button onClick={useAppFrame().openNoteEditor}>open editor</button>;
}

async function makeTasks(answer: NoteResult) {
  fetchMock.mockImplementation(async (url: string) =>
    url === "/api/v1/me"
      ? json(200, { id: 1, email: "u@test.com" })
      : json(201, answer),
  );
  await act(async () => {
    render(
      <AppFrame>
        <Opener />
      </AppFrame>,
    );
  });
  await userEvent.click(screen.getByRole("button", { name: "open editor" }));
  await userEvent.type(
    screen.getByRole("textbox", { name: "Your note" }),
    "call mum",
  );
  await userEvent.click(screen.getByRole("button", { name: "Make tasks" }));
}

beforeEach(() => {
  forgetNotes();
  router.push.mockClear();
  router.replace.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=test-token";
});
afterEach(() => vi.unstubAllGlobals());

describe("Make tasks hands over to the result (IM-43)", () => {
  it("a done note opens its result screen on top of where the editor was opened, closes the editor and keeps the result for it", async () => {
    await makeTasks(result("done"));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/notes/n7"));
    expect(screen.queryByRole("textbox", { name: "Your note" })).toBeNull();
    expect(screen.queryByText(/task made/)).toBeNull();
    expect(recallNote("n7")?.changes).toHaveLength(1);
  });

  it("a note that needs a look keeps the interim until Check this first and the follow-up exist", async () => {
    await makeTasks(result("followup"));

    expect(await screen.findByText("0 tasks made")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Your note" })).toBeNull();
  });
});
