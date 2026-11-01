import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  COMPLETED_PAGE,
  DeleteProjectDialog,
  ProjectScreen,
  ProjectSheet,
  ProjectsScreen,
  type Project,
  type Task,
} from "../../src/ui";
import { projects as seedProjects, task } from "./fixtures";

const seedTasks = (): Task[] => [
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

describe("ProjectsScreen (PJ §2.2)", () => {
  it("renders projects list with progress, alphabetical order and fixed No project", () => {
    const list = [
      { ...seedProjects[1]!, open: 5, done: 3 }, // Adv Web (red)
      { ...seedProjects[0]!, open: 4, done: 2 }, // SQL Course (blue)
    ];
    render(
      <ProjectsScreen
        projects={list}
        noProjectCounts={{ open: 2, done: 1 }}
        accountInitial="E"
        onNewProject={() => {}}
      />,
    );

    // Alphabetical: Adv Web first, then SQL Course
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3); // Adv Web, SQL Course, No project
    expect(within(items[0]!).getByText("Adv Web")).toBeTruthy();
    expect(within(items[1]!).getByText("SQL Course")).toBeTruthy();
    expect(within(items[2]!).getByText("No project")).toBeTruthy();

    expect(within(items[0]!).getByText("3/8")).toBeTruthy();
    expect(within(items[1]!).getByText("2/6")).toBeTruthy();
    expect(within(items[2]!).getByText("1/3")).toBeTruthy();
  });

  it("renders empty state when no projects exist", () => {
    render(
      <ProjectsScreen
        projects={[]}
        accountInitial="E"
        onNewProject={() => {}}
      />,
    );
    expect(screen.getByText("Group tasks by area or goal.")).toBeTruthy();
  });
});

describe("ProjectScreen (PJ-2, T-PJ-10, T-PJ-11)", () => {
  it("renders project header, progress, open tasks and completed tasks", () => {
    const project = seedProjects[0]!;
    const tasks = seedTasks().filter((t) => t.project_id === "p-sql");
    const openTasks = tasks.filter((t) => !t.done);
    const completedTasks = tasks.filter((t) => t.done);

    render(
      <ProjectScreen
        project={project}
        openTasks={openTasks}
        completedTasks={completedTasks}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "SQL Course" }),
    ).toBeTruthy();
    expect(screen.getByText("1 of 3 tasks completed")).toBeTruthy();

    expect(screen.getByText("ER diagram")).toBeTruthy();
    expect(screen.getByText("No date one")).toBeTruthy();
    expect(screen.getByText("Read chapter 4")).toBeTruthy();
  });

  it(`shows ${COMPLETED_PAGE} completed tasks, then Show completed (T-PJ-11)`, async () => {
    const project = seedProjects[1]!;
    const manyCompleted = Array.from({ length: 12 }, (_, i) =>
      task({
        title: `Done ${i}`,
        project_id: "p-web",
        done: true,
        done_at: `2026-10-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
      }),
    );

    render(
      <ProjectScreen
        project={project}
        openTasks={[]}
        completedTasks={manyCompleted}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(COMPLETED_PAGE);
    const button = screen.getByRole("button", { name: "Show completed" });
    expect(button).toBeTruthy();
    await userEvent.click(button);
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
  });
});

describe("ProjectSheet (PJ-1, T-PJ-01)", () => {
  it("creates project with name and color swatch", async () => {
    let created: Project | null = null;
    render(
      <ProjectSheet
        open
        projects={seedProjects}
        onClose={() => {}}
        onCreated={(p) => {
          created = p;
        }}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(input, "Thesis");

    const submitBtn = screen.getByRole("button", { name: "Create" });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(submitBtn);
    expect(created).toBeTruthy();
    expect(created!.name).toBe("Thesis");
  });

  it("disables Create when name is already taken (PJ-E1)", async () => {
    render(
      <ProjectSheet
        open
        projects={seedProjects}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(input, "SQL Course");

    const submitBtn = screen.getByRole("button", { name: "Create" });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("DeleteProjectDialog (PJ-4, T-PJ-30)", () => {
  it("shows plain confirmation when project has no tasks", async () => {
    let confirmed = false;
    render(
      <DeleteProjectDialog
        open
        project={seedProjects[2]!} // HCI
        taskCount={0}
        onConfirm={() => {
          confirmed = true;
        }}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByRole("radio")).toBeNull();
    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    await userEvent.click(deleteBtn);
    expect(confirmed).toBe(true);
  });

  it("shows Move to No project and Delete them too when project has tasks", async () => {
    let chosenAction = "";
    render(
      <DeleteProjectDialog
        open
        project={seedProjects[0]!}
        taskCount={3}
        onConfirm={(action) => {
          chosenAction = action;
        }}
        onCancel={() => {}}
      />,
    );

    const moveRadio = screen.getByRole("radio", {
      name: "Move to No project",
    }) as HTMLInputElement;
    const deleteRadio = screen.getByRole("radio", {
      name: "Delete them too",
    }) as HTMLInputElement;

    expect(moveRadio.checked).toBe(true);
    expect(deleteRadio.checked).toBe(false);

    await userEvent.click(deleteRadio);
    expect(deleteRadio.checked).toBe(true);

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    await userEvent.click(deleteBtn);
    expect(chosenAction).toBe("delete");
  });
});
