import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { dropOntoDay, inboxDropPatch } from "../../src/ui/domain/dropPatch";
import type { Task } from "../../src/ui/domain/types";
import type { ProjectDropData } from "../../src/ui/features/lists/dnd/dropTargets";
import {
  useMoveToProject,
  useReceiveDrop,
} from "../../src/ui/features/lists/useCrossDrop";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

// #178: cross-section drag and drop (No date <-> Today, and sidebar project drops)
const cross: {
  receiveToday?: (
    shown: readonly Task[],
    drop: { id: string; from: string; index: number },
  ) => void;
  receiveNoDate?: (
    shown: readonly Task[],
    drop: { id: string; from: string; index: number },
  ) => void;
  receiveCompleted?: (
    shown: readonly Task[],
    drop: { id: string; from: string; index: number },
  ) => void;
  receiveDay?: (
    shown: readonly Task[],
    drop: { id: string; from: string; index: number },
  ) => void;
  moveToProject?: (id: string, project: ProjectDropData) => void;
} = {};

function CrossDropper() {
  const receiveToday = useReceiveDrop("day_order", (t) =>
    inboxDropPatch(t, "today", TODAY),
  );
  const receiveNoDate = useReceiveDrop("project_order", (t) =>
    inboxDropPatch(t, "no_date", TODAY),
  );
  const receiveCompleted = useReceiveDrop("project_order", (t) =>
    inboxDropPatch(t, "completed", TODAY),
  );
  const receiveDay = useReceiveDrop("day_order", dropOntoDay("2026-11-25"));
  const moveToProject = useMoveToProject();

  useEffect(() => {
    cross.receiveToday = receiveToday;
    cross.receiveNoDate = receiveNoDate;
    cross.receiveCompleted = receiveCompleted;
    cross.receiveDay = receiveDay;
    cross.moveToProject = moveToProject;
  });
  return null;
}

afterEach(() => localStorage.clear());

describe("cross-section drag and drop (#178)", () => {
  it("dropping a No-date task into Today sets due date to today and assigns day_order", async () => {
    const nodate = task({
      id: "nodate-1",
      title: "Untimed Task",
      start_date: null,
      due_date: null,
    });
    const existing = task({
      id: "today-1",
      title: "Existing",
      due_date: TODAY,
      day_order: "a0",
    });
    const { wrap, memory } = setup([nodate, existing]);

    render(wrap(<CrossDropper />));

    act(() => {
      cross.receiveToday!([existing], {
        id: "nodate-1",
        from: "no_date",
        index: 0,
      });
    });

    await waitFor(() => {
      const saved = memory.db.tasks.find((t) => t.id === "nodate-1");
      expect(saved?.due_date).toBe(TODAY);
      expect(saved?.day_order).toBeTruthy();
    });
  });

  it("dropping a Today task into No date clears its dates and assigns project_order", async () => {
    const todayTask = task({
      id: "t-1",
      title: "Today task",
      start_date: TODAY,
      due_date: TODAY,
    });
    const { wrap, memory } = setup([todayTask]);

    render(wrap(<CrossDropper />));

    act(() => {
      cross.receiveNoDate!([], {
        id: "t-1",
        from: "today",
        index: 0,
      });
    });

    await waitFor(() => {
      const saved = memory.db.tasks.find((t) => t.id === "t-1");
      expect(saved?.start_date).toBeNull();
      expect(saved?.due_date).toBeNull();
    });
  });

  it("dropping a task onto a project moves it with a toast, and Undo restores the project", async () => {
    const t = task({
      id: "task-move",
      title: "Task to Move",
      project_id: null,
    });
    const { wrap, memory } = setup([t]);

    render(wrap(<CrossDropper />));

    act(() => {
      cross.moveToProject!("task-move", {
        kind: "project",
        projectId: "proj-work",
        name: "Work",
        title: "Work",
      });
    });

    await waitFor(() => {
      const saved = memory.db.tasks.find((x) => x.id === "task-move");
      expect(saved?.project_id).toBe("proj-work");
    });

    expect(await screen.findByText(/Moved to Work/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      const saved = memory.db.tasks.find((x) => x.id === "task-move");
      expect(saved?.project_id).toBeNull();
    });
  });

  it("dropping an open task into Completed marks it done", async () => {
    const openTask = task({
      id: "open-1",
      title: "Open Task",
      done: false,
      due_date: TODAY,
    });
    const { wrap, memory } = setup([openTask]);

    render(wrap(<CrossDropper />));

    act(() => {
      cross.receiveCompleted!([], {
        id: "open-1",
        from: "today",
        index: 0,
      });
    });

    await waitFor(() => {
      const saved = memory.db.tasks.find((t) => t.id === "open-1");
      expect(saved?.done).toBe(true);
    });
  });

  it("dropping a completed task into Today reopens it and sets due date", async () => {
    const doneTask = task({
      id: "done-1",
      title: "Done Task",
      done: true,
      due_date: null,
    });
    const { wrap, memory } = setup([doneTask]);

    render(wrap(<CrossDropper />));

    act(() => {
      cross.receiveToday!([], {
        id: "done-1",
        from: "completed",
        index: 0,
      });
    });

    await waitFor(() => {
      const saved = memory.db.tasks.find((t) => t.id === "done-1");
      expect(saved?.done).toBe(false);
      expect(saved?.due_date).toBe(TODAY);
    });
  });

  it("dropping a task from one Upcoming day onto another reschedules it and assigns day_order", async () => {
    const upcomingTask = task({
      id: "upcoming-1",
      title: "Scheduled Task",
      start_date: "2026-11-24",
      due_date: "2026-11-24",
    });
    const { wrap, memory } = setup([upcomingTask]);

    render(wrap(<CrossDropper />));

    act(() => {
      cross.receiveDay!([], {
        id: "upcoming-1",
        from: "day:2026-11-24",
        index: 0,
      });
    });

    await waitFor(() => {
      const saved = memory.db.tasks.find((t) => t.id === "upcoming-1");
      expect(saved?.start_date).toBe("2026-11-25");
      expect(saved?.due_date).toBe("2026-11-25");
      expect(saved?.day_order).toBeTruthy();
    });
  });

  it("dropping an overdue task onto an Upcoming day reschedules it and assigns day_order", async () => {
    const overdueTask = task({
      id: "overdue-1",
      title: "Overdue Task",
      start_date: "2026-11-18",
      due_date: "2026-11-20",
    });
    const { wrap, memory } = setup([overdueTask]);

    render(wrap(<CrossDropper />));

    act(() => {
      cross.receiveDay!([], {
        id: "overdue-1",
        from: "overdue",
        index: 0,
      });
    });

    await waitFor(() => {
      const saved = memory.db.tasks.find((t) => t.id === "overdue-1");
      expect(saved?.start_date).toBe("2026-11-25");
      expect(saved?.due_date).toBe("2026-11-27");
      expect(saved?.day_order).toBeTruthy();
    });
  });
});
