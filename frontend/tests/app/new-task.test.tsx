import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import InboxPage from "../../src/app/page";
import NotesPage from "../../src/app/notes/page";
import UpcomingPage from "../../src/app/upcoming/page";
import ProjectsPage from "../../src/app/projects/page";
import { task } from "../ui/fixtures";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

function renderPage(path: string, Page: ComponentType = () => null) {
  currentPathname = path;
  return render(
    <AppFrame>
      <Page />
    </AppFrame>,
  );
}

const user = { id: 1, email: "user@example.com", display_name: "User" };

describe("AppFrame New Task Wiring (IM-26)", () => {
  let lastRequestBody: Record<string, unknown> | null = null;

  beforeEach(() => {
    router.push.mockClear();
    router.replace.mockClear();
    router.back.mockClear();
    lastRequestBody = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.includes("/me")) {
          return new Response(JSON.stringify(user), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (urlStr.includes("/projects")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (urlStr.includes("/tasks") && init?.method === "POST") {
          lastRequestBody = JSON.parse((init.body as string) ?? "{}");
          return new Response(
            JSON.stringify(
              task({ ...lastRequestBody } as unknown as Parameters<
                typeof task
              >[0]),
            ),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("the round + shows on tab screens", async () => {
    const tabScreens: Array<[string, ComponentType]> = [
      ["/", InboxPage],
      ["/upcoming", UpcomingPage],
      ["/projects", ProjectsPage],
      ["/notes", NotesPage],
    ];

    for (const [path, Component] of tabScreens) {
      renderPage(path, Component);
      expect(screen.getByRole("button", { name: "Add a task" })).toBeTruthy();
      cleanup();
    }
  });

  it("opened from Notes: types 'Call mum', Add sends body without due_date, and shows toast 'Added “Call mum”' (TS-09, T-NC-53)", async () => {
    renderPage("/notes", NotesPage);

    const plusButton = screen.getByRole("button", { name: "Add a task" });
    await userEvent.click(plusButton);

    const sheet = screen.getByRole("dialog", { name: "New task" });
    expect(sheet).toBeTruthy();

    const titleInput = within(sheet).getByLabelText("Title");
    await userEvent.type(titleInput, "Call mum");

    const addButton = within(sheet).getByRole("button", { name: "Add" });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(lastRequestBody).toMatchObject({
        title: "Call mum",
      });
      expect(lastRequestBody?.due_date).toBeUndefined();
    });

    await waitFor(() => {
      expect(screen.getByText("Added “Call mum”")).toBeTruthy();
    });
  });

  it("opened from / selects Today chip and Medium priority, from /upcoming selects Tomorrow and Low priority (T-NC-52)", async () => {
    // Opened from /
    renderPage("/", InboxPage);
    await userEvent.click(screen.getByRole("button", { name: "Add a task" }));

    const sheet1 = screen.getByRole("dialog", { name: "New task" });
    const dueGroup1 = within(sheet1).getByRole("radiogroup", { name: "Due" });
    const priorityGroup1 = within(sheet1).getByRole("radiogroup", {
      name: "Priority",
    });

    expect(
      within(dueGroup1)
        .getByRole("radio", { name: "Today" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      within(priorityGroup1)
        .getByRole("radio", {
          name: "Medium",
        })
        .getAttribute("aria-checked"),
    ).toBe("true");

    cleanup();

    // Opened from /upcoming
    renderPage("/upcoming", UpcomingPage);
    await userEvent.click(screen.getByRole("button", { name: "Add a task" }));

    const sheet2 = screen.getByRole("dialog", { name: "New task" });
    const dueGroup2 = within(sheet2).getByRole("radiogroup", { name: "Due" });
    const priorityGroup2 = within(sheet2).getByRole("radiogroup", {
      name: "Priority",
    });

    expect(
      within(dueGroup2)
        .getByRole("radio", { name: "Tomorrow" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      within(priorityGroup2)
        .getByRole("radio", {
          name: "Low",
        })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("pick 'Pick date', type 0,3 / 1,1 / 2,0,2,6, press Enter: form not submitted, focuses Pick date chip, Add creates task with due_date 2026-11-03", async () => {
    renderPage("/", InboxPage);
    await userEvent.click(screen.getByRole("button", { name: "Add a task" }));

    const sheet = screen.getByRole("dialog", { name: "New task" });
    const titleInput = within(sheet).getByLabelText("Title");
    await userEvent.type(titleInput, "Doctor appointment");

    const pickChip = within(sheet).getByRole("radio", { name: "Pick date…" });
    await userEvent.click(pickChip);

    const day = within(sheet).getByRole("spinbutton", { name: "Day" });
    const month = within(sheet).getByRole("spinbutton", { name: "Month" });
    const year = within(sheet).getByRole("spinbutton", { name: "Year" });

    day.focus();
    fireEvent.keyDown(day, { key: "0" });
    fireEvent.keyDown(day, { key: "3" });

    fireEvent.keyDown(month, { key: "1" });
    fireEvent.keyDown(month, { key: "1" });

    fireEvent.keyDown(year, { key: "2" });
    fireEvent.keyDown(year, { key: "0" });
    fireEvent.keyDown(year, { key: "2" });
    fireEvent.keyDown(year, { key: "6" });

    fireEvent.keyDown(year, { key: "Enter" });

    expect(lastRequestBody).toBeNull();
    expect(document.activeElement).toBe(pickChip);

    const addButton = within(sheet).getByRole("button", { name: "Add" });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(lastRequestBody).toMatchObject({
        title: "Doctor appointment",
        due_date: "2026-11-03",
      });
    });
  });

  it("project Picker inside the sheet opens its listbox inside the .modal and choosing a project keeps the sheet open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.includes("/me")) {
          return new Response(JSON.stringify(user), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (urlStr.includes("/projects")) {
          return new Response(
            JSON.stringify([
              { id: "pj-1", name: "Work", colour: "blue" },
              { id: "pj-2", name: "Personal", colour: "green" },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr.includes("/tasks") && init?.method === "POST") {
          lastRequestBody = JSON.parse((init.body as string) ?? "{}");
          return new Response(
            JSON.stringify(
              task({ ...lastRequestBody } as unknown as Parameters<
                typeof task
              >[0]),
            ),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );

    renderPage("/", InboxPage);
    await userEvent.click(screen.getByRole("button", { name: "Add a task" }));

    const sheet = screen.getByRole("dialog", { name: "New task" });
    const modal = sheet.closest(".modal");
    expect(modal).not.toBeNull();

    const projectTrigger = within(sheet).getByRole("button", {
      name: "Project",
    });
    await userEvent.click(projectTrigger);

    const listbox = screen.getByRole("listbox", { name: "Project" });
    expect(modal?.contains(listbox)).toBe(true);

    const workOption = screen.getByRole("option", { name: "Work" });
    await userEvent.click(workOption);

    expect(screen.getByRole("dialog", { name: "New task" })).not.toBeNull();
    expect(
      within(sheet).getByRole("button", { name: "Project" }).textContent,
    ).toContain("Work");
  });

  it("Pick date, then Tab out with nothing typed cancels the pick back to previous due choice", async () => {
    renderPage("/", InboxPage);
    await userEvent.click(screen.getByRole("button", { name: "Add a task" }));

    const sheet = screen.getByRole("dialog", { name: "New task" });
    const todayRadio = within(sheet).getByRole("radio", { name: "Today" });
    const pickChip = within(sheet).getByRole("radio", { name: "Pick date…" });

    expect(todayRadio.getAttribute("aria-checked")).toBe("true");

    await userEvent.click(pickChip);
    expect(pickChip.getAttribute("aria-checked")).toBe("true");

    // Tab through segments and calendar button to leave the date field
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    expect(todayRadio.getAttribute("aria-checked")).toBe("true");
  });
});
