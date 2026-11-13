import { Activity, Suspense } from "react";

import { act, render, screen, waitFor, within } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppFrame } from "../../src/app/AppFrame";

import NoteResultPage from "../../src/app/notes/[id]/page";

import { forgetNotes, rememberNote } from "../../src/lib/noteApi";

import { t, type NoteChange, type NoteResult } from "../../src/ui";

import { task } from "../ui/fixtures";

// IM-43: /notes/{id}. The data comes from the server (a deep link) or from the note just made.

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };

vi.mock("next/navigation", () => ({
  usePathname: () => "/notes/n1",

  useRouter: () => router,

  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,

    headers: { "Content-Type": "application/json" },
  });

const sql = task({ id: "t-sql", title: "SQL quiz", due_date: "2026-10-26" });

const ink = task({ id: "t-ink", title: "Buy printer ink" });

const changes: NoteChange[] = [
  { kind: "created", label: "Mon 26 Oct · 09:00 · SQL Course", task: sql },

  { kind: "created", label: "No date", task: ink },
];

const result: NoteResult = {
  note: {
    id: "n1",

    client_id: "c1",

    status: "done",

    name: "This week",

    text: "sql quiz monday 9am, buy printer ink",

    source_file_name: null,

    written_at: "2026-10-23T08:12:00+07:00",

    processed_at: "2026-10-23T08:12:01+07:00",
    plan_version: 1,
  },

  changes,

  skipped: [],
};

/** The server: the note, and each task by id (a missing one answers 404). */

function serve(
  tasks: Record<string, unknown>,

  note: () => Response,

  actions: Record<string, (body: unknown) => Response> = {},
) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/v1/notes?"))
      return json(200, {
        items: [],

        total: 0,

        needs_count: 0,

        next_cursor: null,
      });

    const action = actions[url];

    if (action) return action(JSON.parse(String(init?.body ?? "{}")));

    if (url === "/api/v1/me") return json(200, { id: 1, email: "u@test.com" });

    if (url === "/api/v1/notes/n1") {
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return note();
    }

    const id = url.match(/^\/api\/v1\/tasks\/(.+)$/)?.[1];

    if (id && init?.method === "PATCH")
      return json(200, {
        ...(tasks[id] as object),

        ...JSON.parse(String(init.body)),
      });

    if (id && tasks[id]) return json(200, tasks[id]);

    return json(404, { error: { code: "error.not_found" } });
  });
}

const calls = (method: string, prefix: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).startsWith(prefix) && (init?.method ?? "GET") === method,
  );

async function open() {
  await act(async () => {
    render(
      <AppFrame>
        <Suspense>
          <NoteResultPage params={Promise.resolve({ id: "n1" })} />
        </Suspense>
      </AppFrame>,
    );
  });
}

beforeEach(() => {
  forgetNotes();

  router.replace.mockClear();

  fetchMock.mockReset();

  vi.stubGlobal("fetch", fetchMock);

  document.cookie = "XSRF-TOKEN=test-token";

  window.history.replaceState(null, "", "/notes/n1");
});

afterEach(() => {
  vi.unstubAllGlobals();

  vi.useRealTimers();
});

describe("Note result page /notes/[id] (IM-43)", () => {
  it("a deep link loads the note and shows its rows", async () => {
    serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result));

    await open();

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();

    expect(screen.getByText("This week")).toBeTruthy();

    expect(screen.getByRole("link", { name: /SQL quiz/ })).toBeTruthy();

    expect(calls("GET", "/api/v1/notes/n1")).toHaveLength(1);
  });

  it("a note made just now isn't asked for again, but its tasks are checked", async () => {
    rememberNote(result);

    serve({ "t-sql": sql, "t-ink": ink }, () => json(500, {}));

    await open();

    expect(await screen.findByText("This week")).toBeTruthy();

    expect(calls("GET", "/api/v1/notes/n1")).toHaveLength(0);

    expect(calls("GET", "/api/v1/tasks/")).toHaveLength(2);
  });

  it("shows the skeleton only after 300 ms on a slow load", async () => {
    vi.useFakeTimers();

    serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result));

    fetchMock.mockImplementationOnce(async () =>
      json(200, { id: 1, email: "u@test.com" }),
    );

    fetchMock.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return json(200, result);
    });

    await open();

    expect(screen.queryByRole("status", { busy: true })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole("status", { busy: true })).toBeTruthy();
  });

  it("404 shows error.not_found with Back", async () => {
    serve({}, () => json(404, { error: { code: "error.not_found" } }));

    await open();

    expect(await screen.findByText(t("error.not_found"))).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.replace).toHaveBeenCalledWith("/notes");
  });

  it("5xx shows error.generic with the request id and Retry loads again", async () => {
    let fail = true;

    serve({ "t-sql": sql, "t-ink": ink }, () =>
      fail
        ? json(500, { error: { code: "error.generic", request_id: "req-9" } })
        : json(200, result),
    );

    await open();

    expect(await screen.findByText(/req-9/)).toBeTruthy();

    fail = false;

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("This week")).toBeTruthy();
  });

  it("a network failure shows app.offline with Retry", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });

      throw new TypeError("Failed to fetch");
    });

    await open();

    expect(await screen.findByText(t("app.offline"))).toBeTruthy();

    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("T-RV-113: a task removed since is marked and doesn't open", async () => {
    serve({ "t-ink": ink }, () => json(200, result));

    await open();

    expect(await screen.findByText(t("note.gone_since"))).toBeTruthy();

    expect(screen.queryByRole("link", { name: /SQL quiz/ })).toBeNull();

    expect(screen.getByRole("link", { name: /Buy printer ink/ })).toBeTruthy();
  });

  it("RV-E3: opened after Undo all, a task brought back without its deleted project says so", async () => {
    const paint = task({
      id: "t-paint",
      title: "Buy paint",
      project_id: "p-x",
    });
    serve({ "t-paint": { ...paint, project_id: null } }, () =>
      json(200, {
        ...result,
        note: { ...result.note, status: "pending" },
        changes: [{ kind: "deleted", label: "Buy paint", task: paint }],
      }),
    );

    await open();

    expect(await screen.findByText(t("note.project_gone"))).toBeTruthy();
  });

  it("a task that can't be checked is shown as the note left it", async () => {
    serve({ "t-ink": ink }, () => json(200, result));

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });

      if (url === "/api/v1/notes/n1") return json(200, result);

      return json(500, {});
    });

    await open();

    expect(await screen.findByRole("link", { name: /SQL quiz/ })).toBeTruthy();

    expect(screen.queryByText(t("note.gone_since"))).toBeNull();
  });

  it("T-RV-05: a When? chip saves the date as a patch and the chips go", async () => {
    serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result));

    await open();

    await screen.findByText("This week");

    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    await waitFor(() =>
      expect(calls("PATCH", "/api/v1/tasks/t-ink")).toHaveLength(1),
    );

    const body = JSON.parse(
      String(calls("PATCH", "/api/v1/tasks/t-ink")[0]![1].body),
    );

    expect(body.due_date).toMatch(/^\d{4}-\d\d-\d\d$/);

    expect(body.at).toBeDefined();

    expect(
      screen.queryByRole("group", { name: t("note.ask_when") }),
    ).toBeNull();

    expect(screen.getByText("Today · No date")).toBeTruthy();
  });

  it("Back goes back to where the editor was opened, never to the editor (T-RV-112, RV-E12)", async () => {
    serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result));

    await open();

    await screen.findByText("This week");

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.replace).toHaveBeenCalledWith("/notes");
  });

  describe("Undo all (IM-44, RV-2)", () => {
    const undone: NoteResult = {
      ...result,

      note: { ...result.note, status: "pending" },

      redo_until: "2026-10-23T08:12:11+07:00",
    };

    const undoUrl = "/api/v1/notes/n1/undo";

    const redoUrl = "/api/v1/notes/n1/redo";

    it("T-RV-11: Undo all marks the note Undone and the toast's Undo redoes it", async () => {
      rememberNote(result);

      serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result), {
        [undoUrl]: () => json(200, undone),

        [redoUrl]: () => json(200, result),
      });

      await open();

      await userEvent.click(
        await screen.findByRole("button", { name: t("note.undo_all") }),
      );

      expect(await screen.findByText(/· Pending/)).toBeTruthy();

      expect(
        screen.queryByRole("button", { name: t("note.undo_all") }),
      ).toBeNull();

      expect(screen.queryByRole("link", { name: /SQL quiz/ })).toBeNull();

      expect(JSON.parse(String(calls("POST", undoUrl)[0]![1].body))).toEqual({
        confirm_conflicts: false,
      });

      await userEvent.click(
        within(screen.getByText(t("note.undone")).closest(".alert")!).getByRole(
          "button",

          { name: t("common.undo") },
        ),
      );

      expect(
        await screen.findByRole("link", { name: /SQL quiz/ }),
      ).toBeTruthy();

      expect(calls("POST", redoUrl)).toHaveLength(1);
    });

    it("RV-E1: edited tasks ask first, Cancel keeps the note, Undo all sends the confirmation", async () => {
      rememberNote(result);

      let conflicted = true;

      serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result), {
        [undoUrl]: (body) =>
          conflicted &&
          !(body as { confirm_conflicts: boolean }).confirm_conflicts
            ? json(409, {
                error: {
                  code: "note.undo_conflicts",

                  tasks: [{ id: "t-sql", title: "SQL quiz" }],
                },
              })
            : json(200, undone),
      });

      await open();

      await userEvent.click(
        await screen.findByRole("button", { name: t("note.undo_all") }),
      );

      const dialog = await screen.findByRole("alertdialog");

      expect(
        within(dialog).getByText(t("note.undo_conflict_title")),
      ).toBeTruthy();

      await userEvent.click(
        within(dialog).getByRole("button", { name: t("common.cancel") }),
      );

      expect(screen.queryByRole("alertdialog")).toBeNull();

      expect(screen.queryByText(/· Pending/)).toBeNull();

      await userEvent.click(
        screen.getByRole("button", { name: t("note.undo_all") }),
      );

      await userEvent.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: t("note.undo_all"),
        }),
      );

      expect(await screen.findByText(/· Pending/)).toBeTruthy();

      conflicted = false;

      expect(calls("POST", undoUrl)).toHaveLength(3);
    });

    it("a refused undo says why and leaves the note done", async () => {
      rememberNote(result);

      serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result), {
        [undoUrl]: () => json(409, { error: { code: "note.undo_expired" } }),
      });

      await open();

      await userEvent.click(
        await screen.findByRole("button", { name: t("note.undo_all") }),
      );

      expect(
        (await screen.findAllByText(t("note.undo_expired"))).length,
      ).toBeGreaterThan(0);

      expect(
        screen.getByRole("button", { name: t("note.undo_all") }),
      ).toBeTruthy();
    });
  });
});

describe("Check this first /notes/[id] (IM-45)", () => {
  const pending: NoteResult = {
    ...result,

    note: { ...result.note, status: "confirm" },

    changes: changes.map((change, index) => ({
      ...change,
      ref: `i${index + 1}`,
    })),
  };

  // The server's answer to apply and cancel

  function serveConfirm() {
    serve({}, () => json(200, pending));

    const base = fetchMock.getMockImplementation()!;

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/v1/notes?"))
        return json(200, {
          items: [],

          total: 0,

          needs_count: 0,

          next_cursor: null,
        });

      if (url === "/api/v1/notes/n1/apply")
        return json(200, { ...result, note: { ...result.note } });

      return base(url, init);
    });
  }

  it("doesn't look up the previewed tasks: they don't exist yet", async () => {
    serveConfirm();

    await open();

    await screen.findByText(t("note.review_title"));

    expect(calls("GET", "/api/v1/tasks/")).toHaveLength(0);
  });

  it("Apply changes applies the note, shows the toast and goes back", async () => {
    serveConfirm();

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.apply_preview") }),
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/notes"));

    expect(calls("POST", "/api/v1/notes/n1/apply")).toHaveLength(1);

    expect(
      await screen.findByText(t("note.made_other", { count: 2 })),
    ).toBeTruthy();
  });

  it("NU-E38: an apply that skipped something stays on the result and lists it", async () => {
    serveConfirm();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url === "/api/v1/notes/n1/apply"
        ? json(200, {
            ...result,
            changes: [],
            skipped: [
              { ref: "u1", text: "Email group", reason: "already_done" },
            ],
          })
        : base(url, init),
    );
    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.apply_preview") }),
    );

    expect(
      await screen.findByText(
        t("note.skip_already_done", { title: "Email group" }),
      ),
    ).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith("/notes");
    expect(
      screen.queryByRole("button", { name: t("note.apply_preview") }),
    ).toBeNull();
  });

  it("leaving the review without changes goes back without asking", async () => {
    serveConfirm();
    await open();
    await userEvent.click(
      await screen.findByRole("button", { name: t("common.back") }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/notes"));
    expect(screen.queryByText(t("note.discard_review_title"))).toBeNull();
  });

  it("leaving the review with an edit asks first, and Discard leaves the note pending", async () => {
    serveConfirm();
    await open();
    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: t("task.title") }),
      " again",
    );
    await userEvent.click(
      screen.getByRole("button", { name: t("common.done") }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: t("common.back") }),
    );
    await screen.findByText(t("note.discard_review_title"));
    await userEvent.click(
      screen.getByRole("button", { name: t("common.keep_editing") }),
    );
    expect(screen.queryByText(t("note.discard_review_title"))).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: t("common.back") }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: t("common.discard_action") }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/notes"));
    expect(calls("POST", "/api/v1/notes/n1/apply")).toHaveLength(0);
  });

  // The server's answer to the toast's undo and redo

  function serveUndo(undo: Response) {
    const base = fetchMock.getMockImplementation()!;

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/notes/n1/undo") return undo.clone();

      if (url === "/api/v1/notes/n1/redo") return json(200, result);

      return base(url, init);
    });
  }

  it("RV-2: the apply toast's Undo undoes the note from the list, and offers redo", async () => {
    serveConfirm();

    serveUndo(
      json(200, { ...result, note: { ...result.note, status: "pending" } }),
    );

    const refetched = vi.fn();

    window.addEventListener("agendal:task-created", refetched);

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.apply_preview") }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: t("common.undo") }),
    );

    expect(await screen.findByText(t("note.undone"))).toBeTruthy();

    expect(calls("POST", "/api/v1/notes/n1/undo")).toHaveLength(1);

    // Once for Apply, once for Undo: the lists show what the note made, then that it's gone

    expect(refetched).toHaveBeenCalledTimes(2);

    await userEvent.click(
      screen.getByRole("button", { name: t("common.undo") }),
    );

    await waitFor(() =>
      expect(calls("POST", "/api/v1/notes/n1/redo")).toHaveLength(1),
    );

    expect(refetched).toHaveBeenCalledTimes(3);

    window.removeEventListener("agendal:task-created", refetched);
  });

  it("RV §2.4: tasks edited since send the toast's Undo to the note, which asks first", async () => {
    serveConfirm();

    serveUndo(
      json(409, {
        error: {
          code: "note.undo_conflicts",

          tasks: [{ id: "t-sql", title: "SQL quiz" }],
        },
      }),
    );

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.apply_preview") }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: t("common.undo") }),
    );

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/notes/n1"));
  });

  it("Edit note opens the text in the editor (T-RV-60, RV-5)", async () => {
    serveConfirm();

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.edit") }),
    );

    expect(await screen.findByRole("textbox")).toBeTruthy();

    expect(screen.getByRole("button", { name: t("note.replan") })).toBeTruthy();
  });

  it("edits made in Task details go with Apply, by entry ref, and nothing else is saved", async () => {
    serveConfirm();

    const refd = {
      ...pending,

      changes: changes.map((c, i) => ({ ...c, ref: `i${i + 1}` })),
    };

    fetchMock.mockImplementation(
      ((base) => async (url: string, init?: RequestInit) =>
        url === "/api/v1/notes/n1" ? json(200, refd) : base(url, init))(
        fetchMock.getMockImplementation()!,
      ),
    );

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );

    await userEvent.click(screen.getByRole("radio", { name: /high/i }));

    await userEvent.click(
      screen.getByRole("button", { name: t("common.done") }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: t("note.apply_preview") }),
    );

    await waitFor(() =>
      expect(calls("POST", "/api/v1/notes/n1/apply")).toHaveLength(1),
    );

    expect(
      JSON.parse(String(calls("POST", "/api/v1/notes/n1/apply")[0]![1].body)),
    ).toEqual({
      edits: { i1: { priority: "high" } },
      plan_version: result.note.plan_version,
    });

    expect(calls("PATCH", "/api/v1/tasks/")).toHaveLength(0);
  });

  it("a failed apply stays on the screen and says why", async () => {
    serve({}, () => json(200, pending));

    const base = fetchMock.getMockImplementation()!;

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url === "/api/v1/notes/n1/apply"
        ? Promise.reject(new TypeError("Failed to fetch"))
        : base(url, init),
    );

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.apply_preview") }),
    );

    // A failed fetch also counts as offline (AP-E4), so the hint can show twice
    expect(
      (await screen.findAllByText(t("note.needs_connection"))).length,
    ).toBeGreaterThan(0);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it("Cancel asks before discarding a task edit, and Apply then sends no edits (UX-13)", async () => {
    serveConfirm();

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );

    await userEvent.clear(
      screen.getByRole("textbox", { name: t("task.title") }),
    );

    await userEvent.type(
      screen.getByRole("textbox", { name: t("task.title") }),

      "Discard this title",
    );

    await userEvent.click(
      screen.getByRole("button", { name: t("common.cancel") }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: t("common.discard_action") }),
    );
    expect(screen.queryByText("Discard this title")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: t("note.apply_preview") }),
    );

    await waitFor(() =>
      expect(calls("POST", "/api/v1/notes/n1/apply")).toHaveLength(1),
    );

    expect(
      JSON.parse(String(calls("POST", "/api/v1/notes/n1/apply")[0]![1].body)),
    ).toEqual({ edits: {}, plan_version: result.note.plan_version });

    expect(calls("PATCH", "/api/v1/tasks/")).toHaveLength(0);
  });

  it("Escape asks before dropping notes typed but not yet saved (UX-13)", async () => {
    serveConfirm();
    await open();
    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );

    await userEvent.type(
      screen.getByRole("textbox", { name: t("task.notes") }),
      "Bring the slides",
    );
    await userEvent.keyboard("{Escape}");

    expect(
      await screen.findByRole("button", { name: t("common.discard_action") }),
    ).toBeTruthy();
  });

  it("Escape in a picker closes the picker only; Back over Discard closes Discard", async () => {
    serveConfirm();
    await open();
    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );
    await userEvent.click(screen.getByRole("radio", { name: /high/i }));
    await userEvent.click(
      screen.getByRole("button", { name: t("task.project") }),
    );
    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("button", { name: t("common.discard_action") }),
    ).toBeNull();
    expect(screen.getByRole("textbox", { name: t("task.title") })).toBeTruthy();

    await userEvent.click(
      screen.getByRole("button", { name: t("common.cancel") }),
    );
    expect(
      await screen.findByRole("button", { name: t("common.discard_action") }),
    ).toBeTruthy();
    // jsdom runs back() asynchronously: wait for its popstate, not a fixed time a busy machine outruns
    await act(async () => {
      const popped = new Promise((resolve) =>
        window.addEventListener("popstate", resolve, { once: true }),
      );
      window.history.back();
      await popped;
    });
    expect(
      screen.queryByRole("button", { name: t("common.discard_action") }),
    ).toBeNull();
    expect(screen.getByRole("textbox", { name: t("task.title") })).toBeTruthy();
  });

  it("a field set back to what it was is no edit: Cancel closes without asking", async () => {
    serveConfirm();
    await open();
    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );
    const before = screen
      .getAllByRole("radio")
      .find((radio) => radio.getAttribute("aria-checked") === "true")!;

    await userEvent.click(screen.getByRole("radio", { name: /high/i }));
    await userEvent.click(before);
    await userEvent.click(
      screen.getByRole("button", { name: t("common.cancel") }),
    );

    expect(
      screen.queryByRole("button", { name: t("common.discard_action") }),
    ).toBeNull();
    expect(screen.queryByRole("textbox", { name: t("task.title") })).toBeNull();
  });

  it("a plan changed on another device reloads instead of applying these edits", async () => {
    serveConfirm();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url === "/api/v1/notes/n1/apply"
        ? json(409, { error: { code: "note.plan_changed" } })
        : base(url, init),
    );
    await open();
    const loads = calls("GET", "/api/v1/notes/n1").length;

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.apply_preview") }),
    );

    expect(await screen.findByText(t("note.plan_changed"))).toBeTruthy();
    await waitFor(() =>
      expect(calls("GET", "/api/v1/notes/n1").length).toBeGreaterThan(loads),
    );
  });

  it("Discard drops the review's edits: coming back to the kept page shows the plan as stored", async () => {
    // Next keeps a page we left mounted but hidden (cacheComponents), then shows it again
    serveConfirm();
    const page = (mode: "visible" | "hidden") => (
      <AppFrame>
        <Suspense>
          <Activity mode={mode}>
            <NoteResultPage params={Promise.resolve({ id: "n1" })} />
          </Activity>
        </Suspense>
      </AppFrame>
    );
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(page("visible"));
    });
    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );
    const title = screen.getByRole("textbox", { name: t("task.title") });
    await userEvent.clear(title);
    await userEvent.type(title, "Edited title");
    await userEvent.click(
      screen.getByRole("button", { name: t("common.done") }),
    );
    expect(screen.getByText("Edited title")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: t("common.back") }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: t("common.discard_action") }),
    );

    await act(async () => view.rerender(page("hidden")));
    await act(async () => view.rerender(page("visible")));

    expect(await screen.findByText("SQL quiz")).toBeTruthy();
    expect(screen.queryByText("Edited title")).toBeNull();
  });

  it("omits a proposed task without deleting it, supports undo, and disables Apply when all are omitted", async () => {
    const proposed = {
      ...pending,

      changes: pending.changes.map((change, index) => ({
        ...change,

        ref: `i${index + 1}`,
      })),
    };

    serve({}, () => json(200, proposed));

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: /SQL quiz/ }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: t("note.dont_add") }),
    );

    expect(screen.queryByRole("button", { name: /SQL quiz/ })).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: t("note.undo_omit") }),
    );

    expect(screen.getByRole("button", { name: /SQL quiz/ })).toBeTruthy();

    for (const title of [/SQL quiz/, /Buy printer ink/]) {
      await userEvent.click(screen.getByRole("button", { name: title }));

      await userEvent.click(
        screen.getByRole("button", { name: t("note.dont_add") }),
      );
    }

    expect(
      (
        screen.getByRole("button", {
          name: t("note.apply_preview"),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    expect(calls("DELETE", "/api/v1/tasks/")).toHaveLength(0);

    expect(calls("POST", "/api/v1/notes/n1/apply")).toHaveLength(0);
  });
});

describe("Follow-up /notes/[id] (IM-46)", () => {
  const followup: NoteResult = {
    ...result,

    note: { ...result.note, status: "followup", text: "idea: a garden" },

    changes: [],

    skipped: [],
  };

  it("Keep it as task opens the review first; nothing is made until Apply (T-RV-22)", async () => {
    serve({}, () => json(200, followup), {
      "/api/v1/notes/n1/make-task": () =>
        json(200, { ...result, note: { ...result.note, status: "confirm" } }),
    });

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.make_one") }),
    );
    await screen.findByText(t("note.review_title"));
    expect(
      screen.getByRole("button", { name: t("note.apply_preview") }),
    ).toBeTruthy();
    expect(calls("POST", "/api/v1/notes/n1/make-task")).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalledWith("/tasks/t-sql");
  });

  it("a failed manual creation keeps the follow-up available for retry", async () => {
    serve({}, () => json(200, followup), {
      "/api/v1/notes/n1/make-task": () =>
        json(500, { error: { code: "error.generic" } }),
    });

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.make_one") }),
    );

    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();

    expect(
      screen.getByRole("heading", { name: t("note.followup_title") }),
    ).toBeTruthy();

    expect(
      (
        screen.getByRole("button", {
          name: t("note.make_one"),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("Edit opens the original text, sends PUT for the same note and refreshes its result (T-RV-23)", async () => {
    let current = followup;

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/v1/notes?"))
        return json(200, {
          items: [],

          total: 0,

          needs_count: 0,

          next_cursor: null,
        });

      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });

      if (url === "/api/v1/notes/n1") {
        if (init?.method === "PUT")
          current = {
            ...followup,

            note: {
              ...followup.note,

              text: "read tomorrow",

              status: "confirm",

              edited_at: "2026-10-23T08:13:00+07:00",
            },
          };

        return json(200, current);
      }

      return json(200, []);
    });

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.followup_edit") }),
    );

    const field = screen.getByRole("textbox", { name: t("note.text_label") });

    expect((field as HTMLTextAreaElement).value).toBe(followup.note.text);

    await userEvent.clear(field);

    await userEvent.type(field, "read tomorrow");

    await userEvent.click(
      screen.getByRole("button", { name: t("note.replan") }),
    );

    await screen.findByRole("button", { name: t("note.apply_preview") });

    expect(calls("PUT", "/api/v1/notes/n1")).toHaveLength(1);

    expect(calls("POST", "/api/v1/notes")).toHaveLength(0);
  });

  it("closing an unchanged follow-up editor leaves its status and text untouched", async () => {
    serve({}, () => json(200, followup));

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.followup_edit") }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: t("common.cancel") }),
    );

    expect(screen.queryByRole("textbox")).toBeNull();

    expect(
      screen.getByRole("heading", { name: t("note.followup_title") }),
    ).toBeTruthy();

    expect(calls("PUT", "/api/v1/notes/n1")).toHaveLength(0);
  });
  it("deleting a follow-up note calls DELETE /api/v1/notes/{id}, and the toast's Undo restores it", async () => {
    serve({}, () => json(200, followup), {
      "/api/v1/notes/n1/restore": () => json(200, followup),
    });

    await open();

    const deleteBtn = await screen.findByRole("button", {
      name: t("note.delete"),
    });
    await userEvent.click(deleteBtn);

    const confirmBtn = within(screen.getByRole("alertdialog")).getByRole(
      "button",
      {
        name: t("common.delete"),
      },
    );
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(calls("DELETE", "/api/v1/notes/n1")).toHaveLength(1);
    });

    // Undo on the toast brings the note back and refreshes the Notes list
    const refreshed = vi.fn();
    window.addEventListener("agendal:note-updated", refreshed);
    await userEvent.click(
      await screen.findByRole("button", { name: t("common.undo") }),
    );
    await waitFor(() =>
      expect(calls("POST", "/api/v1/notes/n1/restore")).toHaveLength(1),
    );
    await waitFor(() => expect(refreshed).toHaveBeenCalled());
    window.removeEventListener("agendal:note-updated", refreshed);
  });

  it("a failed restore offers it again: Retry restores the still-deleted note", async () => {
    let failing = true;
    serve({}, () => json(200, followup), {
      "/api/v1/notes/n1/restore": () =>
        failing
          ? json(500, { error: { code: "error.generic" } })
          : json(200, followup),
    });
    await open();
    await userEvent.click(
      await screen.findByRole("button", { name: t("note.delete") }),
    );
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: t("common.delete"),
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: t("common.undo") }),
    );
    failing = false;
    await userEvent.click(
      await screen.findByRole("button", { name: t("common.retry") }),
    );

    await waitFor(() =>
      expect(calls("POST", "/api/v1/notes/n1/restore")).toHaveLength(2),
    );
  });

  it("RV §2.4: Make tasks again on a pending note replans its text and shows the new result", async () => {
    let current: NoteResult = {
      ...result,
      note: { ...result.note, status: "pending" },
    };
    serve({ "t-sql": sql, "t-ink": ink }, () => json(200, current));
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/notes/n1" && init?.method === "PUT") {
        current = result;
        return json(200, result);
      }
      return base(url, init);
    });

    await open();

    await userEvent.click(
      await screen.findByRole("button", { name: t("note.replan") }),
    );

    await waitFor(() =>
      expect(calls("PUT", "/api/v1/notes/n1")).toHaveLength(1),
    );
    expect(
      JSON.parse(String(calls("PUT", "/api/v1/notes/n1")[0]![1].body)),
    ).toMatchObject({ text: result.note.text });
    expect(
      await screen.findByRole("button", { name: t("note.undo_all") }),
    ).toBeTruthy();
  });
});
