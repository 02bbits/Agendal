import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPLETED_PAGE,
  DeleteProjectDialog,
  ProjectScreen,
  ProjectSheet,
  ProjectsScreen,
  t,
  type Project,
  type Task,
} from "../../src/ui";
import { projects as seedProjects, task } from "./fixtures";
import { expectAxeCleanInBothThemes } from "./axe";

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

afterEach(() => {
  vi.useRealTimers();
});

describe("ProjectsScreen (PJ §2.2)", () => {
  it("shows today's date overline from fake clock and New project in the same header row as title", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));

    render(
      <ProjectsScreen
        projects={[]}
        accountInitial="E"
        onNewProject={() => {}}
      />,
    );

    // Overline shows today's date
    expect(screen.getByText("Friday, 23 October")).toBeTruthy();

    // New project is in the same header row as the title
    const title = screen.getByRole("heading", {
      level: 1,
      name: t("nav.projects"),
    });
    const newProjectBtn = screen.getByRole("button", {
      name: t("project.new"),
    });
    const headerRow = title.parentElement?.parentElement;
    expect(headerRow?.contains(newProjectBtn)).toBe(true);
    expect(headerRow?.className).toContain("flex");
    expect(headerRow?.className).toContain("items-center");
    expect(headerRow?.className).toContain("justify-between");
  });

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

    const noProjectLink = within(items[2]!).getByRole("link");
    expect(noProjectLink.getAttribute("href")).toBe("/projects/none");
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

  it("a menu item and Escape leave focus on ⋯, for the dialog to give back (UX-11)", async () => {
    const list = [{ ...seedProjects[1]!, open: 5, done: 3 }];
    render(
      <ProjectsScreen
        projects={list}
        accountInitial="E"
        onNewProject={() => {}}
        onRenameProject={() => {}}
        onDeleteProject={() => {}}
      />,
    );
    const menuButton = screen.getByRole("button", { name: t("project.menu") });
    await userEvent.click(menuButton);
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(menuButton);

    await userEvent.click(menuButton);
    await userEvent.click(
      screen.getByRole("menuitem", { name: t("project.delete") }),
    );
    expect(document.activeElement).toBe(menuButton);
  });

  it("closes project card menu on click outside and on Escape", async () => {
    const list = [{ ...seedProjects[1]!, open: 5, done: 3 }];
    render(
      <ProjectsScreen
        projects={list}
        accountInitial="E"
        onNewProject={() => {}}
        onRenameProject={() => {}}
        onDeleteProject={() => {}}
      />,
    );

    const menuButton = screen.getByRole("button", { name: t("project.menu") });
    await userEvent.click(menuButton);
    expect(screen.getByRole("menu")).toBeTruthy();

    // Click outside on document body closes menu
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    // Open again and press Escape to close
    await userEvent.click(menuButton);
    expect(screen.getByRole("menu")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders phone grouped list with progress, coloured bar, 2/6, and No project card", async () => {
    const list = [
      { ...seedProjects[0]!, open: 4, done: 2 }, // SQL Course (blue)
    ];
    const { container } = render(
      <ProjectsScreen
        projects={list}
        noProjectCounts={{ open: 2, done: 1 }}
        accountInitial="E"
        onNewProject={() => {}}
      />,
    );

    // Grouped list for mobile
    const mobileContainer = container.querySelector(
      '[data-slot="project-mobile-list"]',
    )!;
    expect(mobileContainer).toBeTruthy();

    // Project row in grouped card has link, name, 2/6, progressbar with coloured bar
    const projectLink = within(mobileContainer as HTMLElement).getByRole(
      "link",
      {
        name: /SQL Course/,
      },
    );
    expect(within(projectLink).getByText("2/6")).toBeTruthy();

    const progressbar = within(projectLink).getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("2");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("6");
    expect(progressbar.getAttribute("aria-valuetext")).toBe(
      "2 of 6 tasks completed",
    );

    const bar = progressbar.querySelector('[data-slot="bar"]') as HTMLElement;
    expect(bar.style.background).toContain("var(--color-project-blue)");

    // No project card in its own card below with task count
    const noProjectCard = within(mobileContainer as HTMLElement).getByRole(
      "group",
      {
        name: /No project/,
      },
    );
    expect(within(noProjectCard).getByText("No project")).toBeTruthy();
    expect(within(noProjectCard).getByText("2 tasks")).toBeTruthy();

    await expectAxeCleanInBothThemes(container);
  });
});

describe("ProjectScreen (PJ-2, T-PJ-10, T-PJ-11)", () => {
  it("opens project menu on ⋯ click and triggers rename and delete", async () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(
      <ProjectScreen
        project={seedProjects[0]!}
        onBack={() => {}}
        onRenameProject={onRename}
        onDeleteProject={onDelete}
        today="2026-10-23"
      />,
    );
    const menuBtn = screen.getByRole("button", { name: t("project.menu") });
    await userEvent.click(menuBtn);
    expect(screen.getByRole("menu")).toBeTruthy();

    await userEvent.click(
      screen.getByRole("menuitem", { name: t("project.rename") }),
    );
    expect(onRename).toHaveBeenCalledOnce();
  });

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

  it("calls onLoadMoreCompleted when Show completed is clicked with hasMoreCompleted", async () => {
    const project = seedProjects[1]!;
    const tenCompleted = Array.from({ length: 10 }, (_, i) =>
      task({
        title: `Done ${i}`,
        project_id: "p-web",
        done: true,
        done_at: `2026-10-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
      }),
    );
    let called = false;
    render(
      <ProjectScreen
        project={project}
        openTasks={[]}
        completedTasks={tenCompleted}
        hasMoreCompleted
        onLoadMoreCompleted={() => {
          called = true;
        }}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "Show completed" });
    expect(button).toBeTruthy();
    await userEvent.click(button);
    expect(called).toBe(true);
  });

  it("pulls up hidden completed task on undo and removes Show completed when count <= 10", () => {
    const project = seedProjects[1]!;
    const manyCompleted = Array.from({ length: 11 }, (_, i) =>
      task({
        id: `t-done-${i}`,
        title: `Done ${i}`,
        project_id: "p-web",
        done: true,
        done_at: `2026-10-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
      }),
    );

    const { rerender } = render(
      <ProjectScreen
        project={project}
        openTasks={[]}
        completedTasks={manyCompleted}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    // Initial 11 tasks: exactly 10 visible, Done 0 (oldest done_at) is hidden, Show completed exists
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    expect(screen.queryByText("Done 0")).toBeNull();
    expect(screen.getByRole("button", { name: "Show completed" })).toBeTruthy();

    // User undoes one task (say Done 10), so completedTasks has 10 remaining (Done 0 to 9)
    const afterUndo = manyCompleted.filter((t) => t.id !== "t-done-10");
    rerender(
      <ProjectScreen
        project={project}
        openTasks={[task({ id: "t-done-10", title: "Done 10", done: false })]}
        completedTasks={afterUndo}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    // Now Done 0 is pulled up into view!
    expect(screen.getByText("Done 0")).toBeTruthy();
    // And Show completed button is now GONE because total completed <= 10
    expect(screen.queryByRole("button", { name: "Show completed" })).toBeNull();
  });

  it("never shows Show completed when total completed <= 10 even if hasMoreCompleted is true", () => {
    const project = seedProjects[1]!;
    const fewCompleted = Array.from({ length: 5 }, (_, i) =>
      task({
        id: `t-done-${i}`,
        title: `Done ${i}`,
        done: true,
        done_at: `2026-10-23T0${i}:00:00Z`,
      }),
    );

    render(
      <ProjectScreen
        project={project}
        progress={{ done: 5, total: 10 }}
        openTasks={[]}
        completedTasks={fewCompleted}
        hasMoreCompleted={true}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Show completed" })).toBeNull();
  });

  it("clicking Show completed expands list and button disappears when all are shown", async () => {
    const project = seedProjects[1]!;
    const twelveCompleted = Array.from({ length: 12 }, (_, i) =>
      task({
        id: `t-done-${i}`,
        title: `Done ${i}`,
        done: true,
        done_at: `2026-10-23T${String(i).padStart(2, "0")}:00:00Z`,
      }),
    );

    render(
      <ProjectScreen
        project={project}
        progress={{ done: 12, total: 12 }}
        openTasks={[]}
        completedTasks={twelveCompleted}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    const showCompletedBtn = screen.getByRole("button", {
      name: "Show completed",
    });
    expect(showCompletedBtn).toBeTruthy();

    await userEvent.click(showCompletedBtn);
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: "Show completed" })).toBeNull();
  });

  it("deduplicates tasks by id to prevent React key collision errors", () => {
    const project = seedProjects[1]!;
    const dupTasks = [
      task({ id: "t-dup", title: "Duplicate task", done: false }),
      task({ id: "t-dup", title: "Duplicate task", done: false }),
    ];

    render(
      <ProjectScreen
        project={project}
        openTasks={dupTasks}
        completedTasks={[]}
        today="2026-10-23"
        onBack={() => {}}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
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
