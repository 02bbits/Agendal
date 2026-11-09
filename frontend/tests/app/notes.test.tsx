import { act, render, screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import NotesClient from "../../src/app/notes/NotesClient";

import { t, tc, type NoteResult } from "../../src/ui";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };

const navigate = vi.fn();

const openNoteEditor = vi.fn();

let query = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,

  useSearchParams: () => query,
}));

vi.mock("../../src/app/AppFrame", () => ({
  useAppFrame: () => ({
    user: { email: "test@example.test" },

    settings: { timeFormat: "24h" },

    navigate,

    openNoteEditor,

    back: router.back,
  }),
}));

vi.mock("../../src/app/notes/[id]/NoteResultClient", () => ({
  default: ({ id, presentation }: { id: string; presentation: string }) => (
    <h2 data-testid="result" data-presentation={presentation}>
      {id}
    </h2>
  ),
}));

const note: NoteResult["note"] = {
  id: "n1",

  client_id: "c1",

  text: "call mum tomorrow",

  name: "Call mum",

  status: "confirm",

  source_file_name: null,

  written_at: "2026-11-04T02:00:00Z",

  processed_at: "2026-11-04T02:00:00Z",

  plan_version: 1,
};

const fetchMock = vi.fn();

let width = 1440;

const listeners = new Set<() => void>();

beforeEach(() => {
  vi.clearAllMocks();

  query = new URLSearchParams();

  width = 1440;

  vi.stubGlobal(
    "fetch",

    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                ...note,

                excerpt: note.text,

                counts: { created: 1, updated: 0, deleted: 0 },
              },
            ],

            total: 1,

            needs_count: 1,

            next_cursor: null,
          }),
        ),
    ),
  );

  vi.stubGlobal("matchMedia", (media: string) => ({
    get matches() {
      return width >= 1280;
    },

    media,

    addEventListener: (_: string, fn: () => void) => listeners.add(fn),

    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
});

afterEach(() => {
  listeners.clear();

  vi.unstubAllGlobals();
});

it("desktop opens a note beside the list without scrolling and closes using Back", async () => {
  const view = render(<NotesClient />);

  await userEvent.click(await screen.findByRole("link", { name: /Call mum/ }));

  expect(router.push).toHaveBeenCalledWith("/notes?note=n1", { scroll: false });

  query = new URLSearchParams("note=n1");

  view.rerender(<NotesClient />);

  expect(screen.getByTestId("result").getAttribute("data-presentation")).toBe(
    "panel",
  );

  expect(
    screen.getByRole("link", { name: /Call mum/ }).getAttribute("aria-current"),
  ).toBe("true");

  await userEvent.click(
    screen.getByRole("button", { name: t("common.close") }),
  );

  expect(router.back).toHaveBeenCalledOnce();
});

it("phone links use the task flow and a selected note changes presentation without remounting on resize", async () => {
  width = 390;

  const view = render(<NotesClient />);

  await userEvent.click(await screen.findByRole("link", { name: /Call mum/ }));

  expect(navigate).toHaveBeenCalledWith("/notes/n1");

  view.rerender(<NotesClient noteId="n1" />);

  const result = screen.getByTestId("result");

  expect(result.getAttribute("data-presentation")).toBe("screen");

  expect(screen.queryByRole("link", { name: /Call mum/ })).toBeNull();

  act(() => {
    width = 1440;

    listeners.forEach((fn) => fn());
  });

  expect(screen.getByTestId("result")).toBe(result);

  expect(result.getAttribute("data-presentation")).toBe("panel");
});

it("filters saved notes through the API", async () => {
  render(<NotesClient />);

  await userEvent.click(
    await screen.findByRole("button", { name: t("notes.needs") }),
  );

  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("filter=needs"),
      ),
    ).toBe(true),
  );
});

it("locks the background and traps focus until the Notes modal closes", async () => {
  const view = render(
    <>
      <nav data-shell-navigation>
        <button>Outside</button>
      </nav>

      <NotesClient />
    </>,
  );

  const opener = await screen.findByRole("link", { name: /Call mum/ });

  await userEvent.click(opener);

  query = new URLSearchParams("note=n1");

  view.rerender(
    <>
      <nav data-shell-navigation>
        <button>Outside</button>
      </nav>

      <NotesClient />
    </>,
  );

  const modal = screen.getByRole("dialog", { name: t("nav.notes") });

  expect(modal.getAttribute("aria-modal")).toBe("true");

  expect(
    (
      screen.getByRole("button", { name: "Outside" })
        .parentElement as HTMLElement
    ).inert,
  ).toBe(true);

  expect(opener.closest("[inert]")).not.toBeNull();

  expect(document.body.style.overflow).toBe("");

  const outsideScroll = new WheelEvent("wheel", {
    bubbles: true,

    cancelable: true,
  });

  window.dispatchEvent(outsideScroll);

  expect(outsideScroll.defaultPrevented).toBe(true);

  const insideScroll = new WheelEvent("wheel", {
    bubbles: true,

    cancelable: true,
  });

  modal.dispatchEvent(insideScroll);

  expect(insideScroll.defaultPrevented).toBe(false);

  const close = screen.getByRole("button", { name: t("common.close") });

  close.focus();

  await userEvent.tab();

  expect(document.activeElement).toBe(close);

  await userEvent.tab({ shift: true });

  expect(document.activeElement).toBe(close);

  await userEvent.keyboard("{Escape}");

  expect(router.back).toHaveBeenCalledOnce();

  query = new URLSearchParams();

  view.rerender(
    <>
      <nav data-shell-navigation>
        <button>Outside</button>
      </nav>

      <NotesClient />
    </>,
  );

  expect(
    (
      screen.getByRole("button", { name: "Outside" })
        .parentElement as HTMLElement
    ).inert,
  ).toBeFalsy();

  expect(opener.closest("[inert]")).toBeNull();

  expect(document.body.style.overflow).toBe("");

  const restoredScroll = new WheelEvent("wheel", { cancelable: true });

  window.dispatchEvent(restoredScroll);

  expect(restoredScroll.defaultPrevented).toBe(false);
});

it("renders the Edited label when edited_at is present (T-RV-64)", async () => {
  fetchMock.mockImplementationOnce(
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              ...note,

              excerpt: note.text,

              edited_at: "2026-11-04T03:00:00Z",

              counts: { created: 1, updated: 0, deleted: 0 },
            },
          ],

          total: 1,

          needs_count: 1,
        }),
      ),
  );

  render(<NotesClient />);

  await screen.findByText("Call mum");

  expect(screen.getByText(t("note.edited_label"))).toBeTruthy();
});

const entry = (overrides: Record<string, unknown>) => ({
  ...note,

  excerpt: note.text,

  counts: { created: 0, updated: 0, deleted: 0 },

  ...overrides,
});

const respondWith = (
  items: unknown[],
  next_cursor: string | null = null,
  total = items.length,
) =>
  new Response(JSON.stringify({ items, total, needs_count: 0, next_cursor }));

it("T-RV-30: lists notes newest first", async () => {
  fetchMock.mockImplementationOnce(async () =>
    respondWith([
      entry({ id: "n2", name: "Newest", written_at: "2026-11-05T02:00:00Z" }),

      entry({ id: "n1", name: "Oldest", written_at: "2026-11-04T02:00:00Z" }),
    ]),
  );

  render(<NotesClient />);

  await screen.findByText("Newest");

  const names = screen
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");

  expect(names.findIndex((text) => text.includes("Newest"))).toBeLessThan(
    names.findIndex((text) => text.includes("Oldest")),
  );
});

it("T-RV-31: card shows time, name, excerpt and status line per status", async () => {
  fetchMock.mockImplementationOnce(async () =>
    respondWith([
      entry({
        id: "a",
        name: "Made note",
        status: "done",
        counts: { created: 2, updated: 0, deleted: 0 },
      }),

      entry({
        id: "b",
        name: "Changed note",
        status: "done",
        counts: { created: 0, updated: 1, deleted: 0 },
      }),

      entry({ id: "c", name: "Look note", status: "confirm" }),
    ]),
  );

  const { container } = render(<NotesClient />);

  await screen.findByText("Made note");

  const card = (name: string) =>
    screen.getByText(name).closest("a")?.textContent ?? "";
  const accepted = t("notes.made");

  expect(card("Made note")).toContain(`${accepted} · ${tc("note.made", 2)}`);

  expect(card("Changed note")).toContain(
    `${accepted} · ${t("note.overline_updated", { count: 1 })}`,
  );

  expect(card("Look note")).toContain(t("notes.needs"));

  expect(screen.getAllByText(note.text)).toHaveLength(3);

  expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
    note.written_at,
  );
});

it("T-RV-32: loads the next page when the list nears its end", async () => {
  let notify: IntersectionObserverCallback = () => {};

  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }

      observe() {}

      disconnect() {}
    },
  );

  fetchMock
    .mockImplementationOnce(async () =>
      respondWith([entry({ id: "p1", name: "First page" })], "cursor-2", 2),
    )
    .mockImplementationOnce(async () =>
      respondWith([entry({ id: "p2", name: "Second page" })], null, 2),
    );

  render(<NotesClient />);

  await screen.findByText("First page");

  act(() =>
    notify(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );

  await screen.findByText("Second page");

  expect(String(fetchMock.mock.calls[1]![0])).toContain("cursor-2");

  expect(screen.getByText("First page")).toBeTruthy();
});

it("T-RV-32: a page still loading for another filter doesn't block the next page", async () => {
  let notify: IntersectionObserverCallback = () => {};
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const nearEnd = () =>
    act(() =>
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  let finishAll: (response: Response) => void = () => {};
  fetchMock
    .mockImplementationOnce(async () =>
      respondWith([entry({ id: "a1", name: "All first" })], "all-2", 2),
    )
    .mockImplementationOnce(
      () => new Promise<Response>((resolve) => (finishAll = resolve)),
    )
    .mockImplementationOnce(async () =>
      respondWith(
        [entry({ id: "n1", name: "Pending first", status: "confirm" })],
        "needs-2",
        2,
      ),
    )
    .mockImplementationOnce(async () =>
      respondWith(
        [entry({ id: "n2", name: "Pending second", status: "confirm" })],
        null,
        2,
      ),
    );
  render(<NotesClient />);
  await screen.findByText("All first");
  nearEnd();
  await userEvent.click(screen.getByRole("button", { name: t("notes.needs") }));
  await screen.findByText("Pending first");
  nearEnd();

  expect(await screen.findByText("Pending second")).toBeTruthy();
  await act(async () => finishAll(respondWith([], null, 2)));
});

it("T-RV-33: a card opens its result", async () => {
  width = 390;

  render(<NotesClient />);

  await userEvent.click(await screen.findByRole("link", { name: /Call mum/ }));

  expect(navigate).toHaveBeenCalledWith("/notes/n1");
});

it("empty list offers Write a note, which opens the note editor", async () => {
  fetchMock.mockImplementationOnce(async () => respondWith([]));

  render(<NotesClient />);

  expect(await screen.findByText(t("note.list_empty"))).toBeTruthy();

  await userEvent.click(
    screen.getByRole("button", { name: t("note.capture_open") }),
  );

  expect(openNoteEditor).toHaveBeenCalledOnce();
});
