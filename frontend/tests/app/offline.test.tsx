import "fake-indexeddb/auto";
import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import InboxPage from "../../src/app/page";
import NotesPage from "../../src/app/notes/page";
import NoteResultPage from "../../src/app/notes/[id]/page";
import { setTimeZone } from "../../src/lib/clock";
import {
  putNoteResult,
  putTasks,
  readNoteEntries,
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
