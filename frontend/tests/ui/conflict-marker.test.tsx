import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { forgetConflicts, markConflict } from "../../src/lib/conflicts";
import { TaskDetails, TaskRow, t } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { TODAY, projectById, task } from "./fixtures";
import { setup } from "./harness";

// IM-52, AP §2.2: a row whose edit lost to a later one elsewhere says so until the task is opened

const milk = task({ id: "t-1", title: "Buy milk" });

const row = () => (
  <ul className="m-0 list-none p-0">
    <TaskRow
      task={milk}
      project={projectById(milk.project_id)}
      today={TODAY}
      timeFormat="24h"
      onToggle={() => {}}
    />
  </ul>
);

afterEach(() => forgetConflicts());

describe("Changed on another device (UX-41)", () => {
  it("marks the row, also for screen readers", async () => {
    const { wrap } = setup([milk]);
    render(wrap(row()));
    expect(screen.queryByText(t("task.changed_elsewhere"))).toBeNull();

    await act(() => markConflict("t-1", "Buy milk"));

    expect(screen.getByText(t("task.changed_elsewhere"))).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Changed on another device/ }),
    ).toBeTruthy();
    await expectAxeCleanInBothThemes();
  });

  it("opening the task clears the marker", async () => {
    await markConflict("t-1", "Buy milk");
    const { wrap } = setup([milk]);
    const view = render(wrap(row()));
    expect(screen.getByText(t("task.changed_elsewhere"))).toBeTruthy();

    await act(async () => {
      view.rerender(
        wrap(
          <>
            {row()}
            <TaskDetails task={milk} onBack={() => {}} />
          </>,
        ),
      );
    });

    expect(screen.queryByText(t("task.changed_elsewhere"))).toBeNull();
  });
});
