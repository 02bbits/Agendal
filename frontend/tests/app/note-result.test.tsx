import { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
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
  },
  changes,
  skipped: [],
};

/** The server: the note, and each task by id (a missing one answers 404). */
function serve(tasks: Record<string, unknown>, note: () => Response) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/v1/me") return json(200, { id: 1, email: "u@test.com" });
    if (url === "/api/v1/notes/n1") return note();
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

  it("Done goes back to where the editor was opened", async () => {
    serve({ "t-sql": sql, "t-ink": ink }, () => json(200, result));
    await open();
    await screen.findByText("This week");

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(router.replace).toHaveBeenCalledWith("/notes");
  });
});
