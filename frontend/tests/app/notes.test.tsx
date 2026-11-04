import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NotesClient from "../../src/app/notes/NotesClient";
import { t, type NoteResult } from "../../src/ui";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
const navigate = vi.fn();
const newNote = vi.fn();
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => query,
}));
vi.mock("../../src/app/AppFrame", () => ({
  useAppFrame: () => ({
    user: { email: "test@example.test" },
    settings: { timeFormat: "24h" },
    openNoteEditor: newNote,
    navigate,
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

it("filters saved notes through the API and offers the shared new-note editor", async () => {
  render(<NotesClient />);
  await userEvent.click(
    await screen.findByRole("button", {
      name: t("notes.needs", { count: 1 }),
    }),
  );
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("filter=needs"),
      ),
    ).toBe(true),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: t("note.new_title") }),
  );
  expect(newNote).toHaveBeenCalledOnce();
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
  expect(document.body.style.overflow).toBe("hidden");
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
});
