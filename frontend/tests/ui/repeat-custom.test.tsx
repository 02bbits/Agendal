import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../src/ui/copy";
import { RepeatCustomDialog } from "../../src/ui/features/tasks/repeat/RepeatCustomDialog";
import { useWideScreen } from "./wideScreen";

afterEach(cleanup);

// Wednesday 18 November 2026: day 18, the third Wednesday of the month
const ANCHOR = "2026-11-18";

function open(onDone = vi.fn()) {
  render(
    <RepeatCustomDialog
      open
      value={{ repeat: "never", repeat_rule: null }}
      anchor={ANCHOR}
      onDone={onDone}
      onCancel={() => {}}
    />,
  );
  return {
    onDone,
    dialog: screen.getByRole("alertdialog", {
      name: t("repeat_custom.title"),
    }),
  };
}

describe("Custom repeat dialog (#154)", () => {
  it("Every steps with − and +, and − stops at 1", async () => {
    const { dialog, onDone } = open();
    const every = within(dialog).getByLabelText(t("repeat_custom.every"), {
      selector: "input",
    });
    const less = within(dialog).getAllByRole("button", {
      name: t("common.decrease"),
    })[0]!;
    const more = within(dialog).getAllByRole("button", {
      name: t("common.increase"),
    })[0]!;
    expect((every as HTMLInputElement).value).toBe("1");
    expect(less.hasAttribute("disabled")).toBe(true);
    await userEvent.click(more);
    await userEvent.click(more);
    expect((every as HTMLInputElement).value).toBe("3");
    await userEvent.click(less);
    await userEvent.click(
      within(dialog).getByRole("button", { name: t("repeat_custom.done") }),
    );
    expect(onDone.mock.calls[0]![0].repeat_rule).toContain("INTERVAL=2");
  });

  it("Every takes digits only, and arrow keys step it", async () => {
    const { dialog } = open();
    const every = within(dialog).getByLabelText(t("repeat_custom.every"), {
      selector: "input",
    }) as HTMLInputElement;
    await userEvent.clear(every);
    await userEvent.type(every, "1a2");
    expect(every.value).toBe("12");
    await userEvent.keyboard("{ArrowUp}");
    expect(every.value).toBe("13");
  });

  it("names the two monthly choices by what they mean", async () => {
    const { dialog } = open();
    await userEvent.click(
      within(dialog).getByRole("radio", { name: t("repeat_unit.month") }),
    );
    expect(
      within(dialog).getByRole("radio", { name: "Day 18 of each month" }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("radio", {
        name: "The third Wednesday of each month",
      }),
    ).toBeTruthy();
  });

  it("Ends on (phone): the calendar shows as soon as On is picked", async () => {
    const { dialog, onDone } = open();
    const calendars = () =>
      within(dialog)
        .queryAllByRole("group", { name: t("repeat_end.on") })
        .filter((group) => within(group).queryByRole("grid"));
    expect(calendars()).toHaveLength(0);
    await userEvent.click(
      within(dialog).getByRole("radio", { name: t("repeat_end.on") }),
    );
    const calendar = calendars()[0]!;
    await userEvent.click(
      within(calendar).getByRole("gridcell", { name: /^25/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: t("repeat_custom.done") }),
    );
    expect(onDone.mock.calls[0]![0].repeat_rule).toContain("UNTIL=20261125");
  });

  it("Ends on (desktop): the calendar is always beside the rule, off until On", async () => {
    useWideScreen();
    const { dialog } = open();
    const calendar = within(dialog)
      .getAllByRole("group", { name: t("repeat_end.on") })
      .find((group) => within(group).queryByRole("grid"))!;
    expect(calendar.getAttribute("aria-disabled")).toBe("true");
    expect(
      within(calendar).getByRole("gridcell", { name: /^25/ }),
    ).toHaveProperty("disabled", true);
    await userEvent.click(
      within(dialog).getByRole("radio", { name: t("repeat_end.on") }),
    );
    expect(calendar.getAttribute("aria-disabled")).toBeNull();
    expect(
      within(calendar).getByRole("gridcell", { name: /^25/ }),
    ).toHaveProperty("disabled", false);
  });

  it("Cancel and Done sit side by side", () => {
    const { dialog } = open();
    const cancel = within(dialog).getByRole("button", {
      name: t("common.cancel"),
    });
    const done = within(dialog).getByRole("button", {
      name: t("repeat_custom.done"),
    });
    expect(cancel.parentElement).toBe(done.parentElement);
    expect(cancel.parentElement!.className).toContain("flex-row");
  });
});
