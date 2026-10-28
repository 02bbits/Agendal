import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  COMPLETED_PAGE,
  ProjectScreen,
  ProjectSheet,
  ProjectsScreen,
  defaultProjectColour,
  projectNameError,
  projectNameValid,
  projectProgress,
  sortProjects,
  useTaskStore,
  type Project,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { projects, task } from "./fixtures";
import { setup } from "./harness";

/** Tiny router over the three project screens. */
function App() {
  const store = useTaskStore();
  const [route, setRoute] = useState<
    { name: "list" } | { name: "project"; id: string }
  >({ name: "list" });
  const [creating, setCreating] = useState(false);
  const navigate = (href: string) => {
    const id = href.match(/^\/projects\/(.+)$/)?.[1];
    if (id) setRoute({ name: "project", id: decodeURIComponent(id) });
    return true;
  };
  const project =
    route.name === "project"
      ? store.projects.find((p) => p.id === route.id)
      : undefined;
  return (
    <>
      {project ? (
        <ProjectScreen
          project={project}
          onBack={() => setRoute({ name: "list" })}
          onDeleted={() => setRoute({ name: "list" })}
          navigate={navigate}
        />
      ) : (
        <ProjectsScreen
          accountInitial="e"
          onNewProject={() => setCreating(true)}
          navigate={navigate}
        />
      )}
      {creating && (
        <ProjectSheet
          open
          onClose={() => setCreating(false)}
          onCreated={(p: Project) => setRoute({ name: "project", id: p.id })}
        />
      )}
    </>
  );
}

const seedTasks = () => [
  task({
    title: "ER diagram",
    project_id: "p-sql",
    due_date: "2026-10-26",
    priority: "high",
  }),
  task({
    title: "Read chapter 4",
    project_id: "p-sql",
    done: true,
    done_at: "2026-10-22T10:00:00Z",
  }),
  task({ title: "No date one", project_id: "p-sql" }),
  task({ title: "Loose task" }),
];

describe("project rules", () => {
  it("validates names: trimmed, case-insensitive, 1–40 characters (PJ-E1, PJ-E8)", () => {
    expect(projectNameError("hci ", projects)).toBe("project.name_taken");
    expect(projectNameError("HCI 2", projects)).toBeNull();
    expect(projectNameValid("   ")).toBe(false);
    expect(projectNameValid("Đồ án tốt nghiệp 🎓")).toBe(true);
    expect(projectNameValid("🎓".repeat(40))).toBe(true);
    expect(projectNameValid("a".repeat(41))).toBe(false);
  });

  it("defaults to the first unused colour", () => {
    expect(defaultProjectColour(projects)).toBe("yellow");
    expect(defaultProjectColour([])).toBe("blue");
  });

  it("sorts alphabetically, ignoring case", () => {
    expect(
      sortProjects([
        ...projects,
        { id: "x", name: "adv basics", colour: "teal", created_at: "" },
      ]).map((p) => p.name),
    ).toEqual([
      "adv basics",
      "Adv Web",
      "HCI",
      "Personal",
      "Portfolio",
      "SQL Course",
    ]);
  });

  it("counts open and completed tasks in progress (PJ-2)", () => {
    expect(projectProgress(seedTasks(), "p-sql")).toEqual({
      done: 1,
      total: 3,
    });
  });
});

describe("Projects list and create (PJ-1, T-PJ-01–03)", () => {
  it("lists projects alphabetically with progress, No project last", async () => {
    const { wrap } = setup(seedTasks());
    render(wrap(<App />));
    expect(screen.getByText("5 projects")).toBeTruthy();
    const items = within(screen.getAllByRole("list")[0]!).getAllByRole(
      "listitem",
    );
    expect(
      items.map((li) => li.querySelector('[data-slot="name"]')!.textContent),
    ).toEqual([
      "Adv Web",
      "HCI",
      "Personal",
      "Portfolio",
      "SQL Course",
      "No project",
    ]);
    expect(
      screen.getByRole("link", { name: "SQL Course, 1 of 3 tasks completed" }),
    ).toBeTruthy();
    await expectAxeCleanInBothThemes();
  });

  it("creates a project with a colour and opens it straight away", async () => {
    const { wrap, memory } = setup([]);
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("button", { name: "New project" }));
    const sheet = screen.getByRole("dialog", { name: "New project" });
    expect(
      (within(sheet).getByRole("radio", { name: "Yellow" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    await userEvent.type(within(sheet).getByLabelText("Name"), "Thesis");
    await userEvent.click(within(sheet).getByRole("radio", { name: "Teal" }));
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Create" }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Thesis" }),
    ).toBeTruthy();
    expect(screen.getByText("No tasks yet")).toBeTruthy();
    await waitFor(() =>
      expect(memory.db.projects.find((p) => p.name === "Thesis")).toMatchObject(
        { colour: "teal" },
      ),
    );
  });

  it("refuses a taken name with the message (PJ-E1)", async () => {
    const { wrap } = setup([]);
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("button", { name: "New project" }));
    const sheet = screen.getByRole("dialog", { name: "New project" });
    await userEvent.type(within(sheet).getByLabelText("Name"), "hci ");
    await userEvent.tab();
    expect(
      within(sheet).getByText("You already have a project called “hci”."),
    ).toBeTruthy();
    expect(
      (
        within(sheet).getByRole("button", {
          name: "Create",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("is axe clean with the sheet open", async () => {
    const { wrap } = setup([]);
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("button", { name: "New project" }));
    await expectAxeCleanInBothThemes();
  });
});

describe("Project screen (PJ-2, T-PJ-10, T-PJ-11)", () => {
  it("shows progress, open tasks by due date (no date last) and completed below", async () => {
    const { wrap } = setup(seedTasks());
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("link", { name: /^SQL Course/ }));
    expect(screen.getByText("1 of 3 tasks completed")).toBeTruthy();
    const [open, done] = screen.getAllByRole("list");
    expect(
      within(open!)
        .getAllByRole("link")
        .map((a) => a.querySelector('[data-slot="title"]')!.textContent),
    ).toEqual(["ER diagram", "No date one"]);
    expect(within(done!).getByText("Read chapter 4")).toBeTruthy();
    await expectAxeCleanInBothThemes();
  });

  it(`shows ${COMPLETED_PAGE} completed tasks, then Show completed`, async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      task({
        title: `Done ${i}`,
        project_id: "p-web",
        done: true,
        done_at: `2026-10-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
      }),
    );
    const { wrap } = setup(many);
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("link", { name: /^Adv Web/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(COMPLETED_PAGE);
    expect(screen.getAllByRole("checkbox")[0]!.getAttribute("aria-label")).toBe(
      "Reopen Done 11",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show completed" }),
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
  });
});

describe("Delete a project (PJ-4, T-PJ-30, T-PJ-31)", () => {
  it("without tasks: a plain confirmation", async () => {
    const { wrap, memory } = setup([]);
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("link", { name: /^HCI/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    const dialog = screen.getByRole("alertdialog", { name: "Delete “HCI”?" });
    expect(within(dialog).queryByRole("radio")).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(memory.db.projects.some((p) => p.id === "p-hci")).toBe(false),
    );
  });

  it("moves tasks to No project by default, and Undo puts them back", async () => {
    const { wrap, memory } = setup(seedTasks());
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("link", { name: /^SQL Course/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete “SQL Course”?",
    });
    expect(
      document.getElementById(dialog.getAttribute("aria-describedby")!)!
        .textContent,
    ).toBe("It has 3 tasks. What should happen to them?");
    expect(
      (
        within(dialog).getByRole("radio", {
          name: "Move to No project",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" }),
    );

    expect(screen.getByText("Deleted “SQL Course”")).toBeTruthy();
    await waitFor(() =>
      expect(memory.db.tasks.filter((x) => x.project_id === null)).toHaveLength(
        4,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(
        memory.db.tasks.filter((x) => x.project_id === "p-sql"),
      ).toHaveLength(3),
    );
    await screen.findByRole("link", {
      name: "SQL Course, 1 of 3 tasks completed",
    });
  });

  it("Delete them too removes the tasks, and Undo restores them", async () => {
    const { wrap, memory } = setup(seedTasks());
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("link", { name: /^SQL Course/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    await userEvent.click(
      screen.getByRole("radio", { name: "Delete them too" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(memory.db.tasks.map((x) => x.title)).toEqual(["Loose task"]),
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(memory.db.tasks).toHaveLength(4));
    await screen.findByRole("link", {
      name: "SQL Course, 1 of 3 tasks completed",
    });
  });

  it("dialog with tasks is axe clean", async () => {
    const { wrap } = setup(seedTasks());
    render(wrap(<App />));
    await userEvent.click(screen.getByRole("link", { name: /^SQL Course/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    await expectAxeCleanInBothThemes();
  });
});
