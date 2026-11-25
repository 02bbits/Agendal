import "fake-indexeddb/auto";
import { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import InboxPage from "../../src/app/page";
import NotesPage from "../../src/app/notes/page";
import NoteResultPage from "../../src/app/notes/[id]/page";
import { setTimeZone } from "../../src/lib/clock";
import {
  addFailedNote,
  putNoteResult,
  putTasks,
  readNoteEntries,
  readQueue,
  readTasks,
} from "../../src/lib/localStore";
import { t, type NoteResult } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "../ui/axe";
import { task } from "../ui/fixtures";
import { TODAY } from "../ui/harness";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const milk = task({ id: "t-1", title: "Buy milk", due_date: TODAY });
const inboxData = {
  overdue: [],
  today: [milk],
  no_date: [],
  completed_today: [],
  progress: { done: 0, total: 1 },
  no_date_count: 0,
  completed_count: 0,
};

const note: NoteResult = {
  note: {
    id: "n1",
    client_id: "c1",
    status: "done",
    name: "Groceries",
    text: "buy milk tomorrow",
    source_file_name: null,
    written_at: "2026-10-23T08:12:00+07:00",
    processed_at: "2026-10-23T08:12:01+07:00",
    plan_version: 1,
  },
  changes: [{ kind: "created", label: "Sat 24 Oct", task: milk }],
  skipped: [],
};

let networkUp = true;
const fetchMock = vi.fn(async (url: string) => {
  if (!networkUp) throw new TypeError("Failed to fetch");
  if (url.includes("/me")) return json(200, { id: 1, email: "u@test.com" });
  if (url.includes("view=inbox")) return json(200, inboxData);
  if (url.includes("/projects")) return json(200, []);
  if (url.startsWith("/api/v1/notes?"))
    return json(200, {
      items: [],
      next_cursor: null,
      total: 0,
      needs_count: 0,
    });
  if (url === "/api/v1/notes/n1") return json(200, note);
  // A pending note sent after reconnect (NC-6)
  if (url === "/api/v1/notes") return json(200, note);
  if (url.startsWith("/api/v1/sync?"))
    return json(200, {
      changes: { tasks: [], projects: [], notes: [] },
      next_cursor: 1,
      has_more: false,
    });
  return json(200, {});
});

let onLine = true;

function setOnline(value: boolean) {
  onLine = value;
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

const banner = () => screen.queryByText(t("app.offline"));

async function openInbox() {
  await act(async () => {
    render(
      <AppFrame>
        <Suspense>
          <InboxPage />
        </Suspense>
      </AppFrame>,
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
  setTimeZone("Asia/Ho_Chi_Minh");
  pathname = "/";
  networkUp = true;
  onLine = true;
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => onLine,
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase("agendal");
    request.onsuccess = request.onerror = resolve;
  });
});

describe("Offline banner (AP-2, UX-40)", () => {
  it("T-AP-10: going offline shows the banner within 2 s; coming back hides it", async () => {
    await openInbox();
    expect(banner()).toBeNull();

    await act(async () => setOnline(false));
    expect(
      await screen.findByText(t("app.offline"), {}, { timeout: 2000 }),
    ).toBeTruthy();
    expect(screen.getByText(t("app.offline_body"))).toBeTruthy();
    await expectAxeCleanInBothThemes();

    await act(async () => setOnline(true));
    expect(banner()).toBeNull();
  });

  it("shows only on the tab screens, not Sign in", async () => {
    pathname = "/sign-in";
    onLine = false;
    await act(async () => {
      render(<AppFrame>{null}</AppFrame>);
    });
    expect(banner()).toBeNull();
  });

  it("T-AP-104: onLine says connected but fetches fail: the banner shows; the next answer hides it", async () => {
    networkUp = false;
    await openInbox();
    expect(
      await screen.findByText(t("app.offline"), {}, { timeout: 2000 }),
    ).toBeTruthy();

    networkUp = true;
    await act(async () => {
      window.dispatchEvent(new Event("agendal:task-created"));
    });
    await vi.waitFor(() => expect(banner()).toBeNull());
  });
});

describe("Device store (IM-51)", () => {
  it("keeps the tasks a list loads", async () => {
    await openInbox();
    await screen.findByText("Buy milk");
    await vi.waitFor(async () =>
      expect((await readTasks()).map((x) => x.id)).toEqual(["t-1"]),
    );
  });

  it("Inbox opens from the device when the network is down", async () => {
    await putTasks([milk]);
    networkUp = false;
    await openInbox();

    expect(await screen.findByText("Buy milk")).toBeTruthy();
    expect(screen.queryByText(t("error.generic"))).toBeNull();
    expect(banner()).toBeTruthy();
  });
});

describe("Notes on the device (IM-51)", () => {
  it("opening a note keeps it, with its Notes row", async () => {
    pathname = "/notes/n1";
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <NoteResultPage params={Promise.resolve({ id: "n1" })} />
          </Suspense>
        </AppFrame>,
      );
    });
    await vi.waitFor(async () =>
      expect(await readNoteEntries()).toMatchObject([
        { id: "n1", excerpt: "buy milk tomorrow", counts: { created: 1 } },
      ]),
    );
  });

  it("the Notes list opens from the device when the network is down", async () => {
    await putNoteResult(note);
    networkUp = false;
    pathname = "/notes";
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <NotesPage />
          </Suspense>
        </AppFrame>,
      );
    });
    expect(await screen.findByRole("link", { name: /Groceries/ })).toBeTruthy();
    expect(banner()).toBeTruthy();
  });

  it("a note opens from the device when the network is down", async () => {
    await putNoteResult(note);
    networkUp = false;
    pathname = "/notes/n1";
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <NoteResultPage params={Promise.resolve({ id: "n1" })} />
          </Suspense>
        </AppFrame>,
      );
    });
    expect((await screen.findAllByText("Buy milk")).length).toBeGreaterThan(0);
  });
});

describe("Offline notes (NC-6, WF-05)", () => {
  const writeNote = async (text: string) => {
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: t("note.capture_open") }));
    await u.type(
      await screen.findByRole("textbox", { name: "Your note" }),
      text,
    );
    await u.click(screen.getByRole("button", { name: t("note.save_offline") }));
  };
  const openNotes = async () => {
    pathname = "/notes";
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <NotesPage />
          </Suspense>
        </AppFrame>,
      );
    });
  };

  it("OFF-03, T-NC-40: Save note keeps the note; the Notes tab shows it as Waiting for connection, not as a link", async () => {
    await openNotes();
    networkUp = false;
    setOnline(false);
    await writeNote("buy milk tomorrow");

    expect(await screen.findByText(t("note.saved_offline"))).toBeTruthy();
    expect(await readQueue()).toMatchObject([
      { entry: { kind: "note", body: { text: "buy milk tomorrow" } } },
    ]);
    expect(await screen.findByText(t("note.waiting"))).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /buy milk tomorrow/ }),
    ).toBeNull();
    await expectAxeCleanInBothThemes();
  });

  it("OFF-04, T-NC-41: on reconnect the pending notes are sent and one toast reports the totals", async () => {
    await openNotes();
    networkUp = false;
    setOnline(false);
    await writeNote("buy milk tomorrow");
    await screen.findByText(t("note.waiting"));

    networkUp = true;
    await act(async () => setOnline(true));

    expect(
      await screen.findByText("Back online. 1 note turned into 1 task."),
    ).toBeTruthy();
    await waitFor(async () => expect(await readQueue()).toEqual([]));
  });

  it("NU §3: a refused note shows Couldn't turn this note into tasks; tapping it puts its text back in the editor", async () => {
    await addFailedNote({
      client_id: "c-failed",
      text: "refused text",
      written_at: "2026-10-23T08:00:00.000Z",
      timezone: "Asia/Ho_Chi_Minh",
    });
    await openNotes();
    const name = new RegExp(t("note.couldnt_process"));
    const card = await screen.findByRole("button", { name });
    await expectAxeCleanInBothThemes();

    await userEvent.setup().click(card);

    const field = await screen.findByRole("textbox", { name: "Your note" });
    await waitFor(() =>
      expect((field as HTMLTextAreaElement).value).toBe("refused text"),
    );
    // The list reloads once its changes settle (AP §10)
    await waitFor(() =>
      expect(screen.queryByRole("button", { name })).toBeNull(),
    );
  });
});
