import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  NoteResultScreen,
  t,
  type NoteChange,
  type NoteResult,
  type NoteResultScreenProps,
  type SkippedItem,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { TODAY } from "./fixtures";
import { task } from "./fixtures";

// IM-43: the result screen (RV-1). Friday 23 Oct 2026, 08:12 in Ho Chi Minh City
const NOW = new Date("2026-10-23T08:30:00+07:00");

const sql: NoteChange = {
  kind: "created",
  label: "Mon 26 Oct · 09:00 · SQL Course",
  task: task({ id: "t-sql", title: "SQL quiz", due_date: "2026-10-26" }),
};
const hci: NoteChange = {
  kind: "updated",
  label: "Fri 30 Oct · HCI",
  was: "Wed 28 Oct",
  task: task({ id: "t-hci", title: "HCI reading", due_date: "2026-10-30" }),
};
const old: NoteChange = {
  kind: "deleted",
  label: "Old reading list",
  task: task({ id: "t-old", title: "Old reading list" }),
};
const ink: NoteChange = {
  kind: "created",
  label: "No date",
  task: task({ id: "t-ink", title: "Buy printer ink" }),
};

function resultOf(
  changes: NoteChange[],
  skipped: SkippedItem[] = [],
  note: Partial<NoteResult["note"]> = {},
): NoteResult {
  return {
    note: {
      id: "n1",
      client_id: "c1",
      status: "done",
      name: "This week",
      text: "sql quiz monday 9am, move hci reading to friday",
      source_file_name: null,
      written_at: "2026-10-23T08:12:00+07:00",
      processed_at: "2026-10-23T08:12:01+07:00",
      plan_version: 1,
      ...note,
    },
    changes,
    skipped,
  };
}

function open(result: NoteResult, props: Partial<NoteResultScreenProps> = {}) {
  const onDone = vi.fn();
  const onSetDue = vi.fn();
  const onUndo = vi.fn();
  const onCancelUndo = vi.fn();
  render(
    <main>
      <NoteResultScreen
        result={result}
        today={TODAY}
        now={NOW}
        timeZone="Asia/Ho_Chi_Minh"
        timeFormat="24h"
        weekStart="mon"
        onDone={onDone}
        onSetDue={onSetDue}
        onUndo={onUndo}
        onCancelUndo={onCancelUndo}
        {...props}
      />
    </main>,
  );
  return { onDone, onSetDue, onUndo, onCancelUndo };
}

describe("Note result (IM-43, RV-1)", () => {
  it("T-RV-01: every kind of change has its badge as text", () => {
    open(resultOf([sql, hci, old]));
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("CREATED")).toBeTruthy();
    expect(within(rows[1]!).getByText("UPDATED")).toBeTruthy();
    expect(within(rows[2]!).getByText("DELETED")).toBeTruthy();
  });

  it("shows the time and the counts, and leaves zero counts out", () => {
    open(resultOf([sql, hci, old]));
    expect(
      screen.getByText("Today 08:12 · 1 task made · 1 changed · 1 deleted"),
    ).toBeTruthy();
  });

  it("an update-only note has no 'made' count", () => {
    open(resultOf([hci]));
    expect(screen.getByText("Today 08:12 · 1 changed")).toBeTruthy();
  });

  it("T-RV-02: each row shows its meta, and an update shows the old value", () => {
    open(resultOf([sql, hci]));
    expect(screen.getByText("Mon 26 Oct · 09:00 · SQL Course")).toBeTruthy();
    expect(screen.getByText("Fri 30 Oct · HCI · was Wed 28 Oct")).toBeTruthy();
  });

  it("renaming: Escape and Enter give focus back to the pencil (UX-11)", async () => {
    const onRename = vi.fn().mockResolvedValue(true);
    open(resultOf([sql]), { onRename });
    const pencil = () => screen.getByRole("button", { name: t("note.rename") });
    await userEvent.click(pencil());
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(pencil());

    await userEvent.click(pencil());
    await userEvent.keyboard(" week 2{Enter}");
    expect(onRename).toHaveBeenCalledWith("This week week 2");
    expect(document.activeElement).toBe(pencil());
  });

  it("a deleted row shows its title once, and a delete-only note says deleted, not made", () => {
    open(resultOf([old]));
    expect(screen.getAllByText("Old reading list")).toHaveLength(1);
    expect(screen.getByText("Today 08:12 · 1 deleted")).toBeTruthy();
  });

  it("T-RV-03: created and updated rows open their task, a deleted one does not", () => {
    open(resultOf([sql, hci, old]));
    expect(
      screen.getByRole("link", { name: /SQL quiz/ }).getAttribute("href"),
    ).toBe("/tasks/t-sql");
    expect(
      screen.getByRole("link", { name: /HCI reading/ }).getAttribute("href"),
    ).toBe("/tasks/t-hci");
    expect(screen.queryByRole("link", { name: /Old reading list/ })).toBeNull();
  });

  it("T-RV-113: a task removed since says so and doesn't open", () => {
    open(resultOf([sql, hci]), { live: { "t-sql": null } });
    expect(screen.queryByRole("link", { name: /SQL quiz/ })).toBeNull();
    expect(screen.getByText(t("note.gone_since"))).toBeTruthy();
    expect(screen.getByRole("link", { name: /HCI reading/ })).toBeTruthy();
  });

  it("T-RV-04: When? chips only on a created task with no date", () => {
    open(
      resultOf([
        sql,
        ink,
        { ...hci, task: task({ id: "t-h2", title: "No-date update" }) },
      ]),
    );
    const groups = screen.getAllByRole("group", { name: t("note.ask_when") });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.closest("li")!.textContent).toContain("Buy printer ink");
  });

  it("T-RV-05: a chip hands over the date it stands for", async () => {
    const { onSetDue } = open(resultOf([ink]));
    const group = screen.getByRole("group", { name: t("note.ask_when") });
    await userEvent.click(within(group).getByRole("button", { name: "Today" }));
    await userEvent.click(
      within(group).getByRole("button", { name: "Tomorrow" }),
    );
    // Friday 23 Oct: next week starts on Monday 26 Oct
    await userEvent.click(
      within(group).getByRole("button", { name: "Next week" }),
    );
    expect(onSetDue.mock.calls.map(([, date]) => date)).toEqual([
      "2026-10-23",
      "2026-10-24",
      "2026-10-26",
    ]);
    expect(onSetDue.mock.calls[0]![0].id).toBe("t-ink");
  });

  it("Next week follows the week-start setting", async () => {
    const { onSetDue } = open(resultOf([ink]), { weekStart: "sun" });
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(onSetDue).toHaveBeenCalledWith(expect.anything(), "2026-10-25");
  });

  it("Pick date… opens a date field and hands over what was picked", async () => {
    const { onSetDue } = open(resultOf([ink]));
    await userEvent.click(screen.getByRole("button", { name: "Pick date…" }));
    fireEvent.change(screen.getByLabelText("Pick date…"), {
      target: { value: "2026-11-05" },
    });
    expect(onSetDue).toHaveBeenCalledWith(expect.anything(), "2026-11-05");
  });

  it("once the task has a date the chips go and the date leads the meta", () => {
    open(resultOf([ink]), {
      live: { "t-ink": { ...ink.task, due_date: "2026-10-24" } },
    });
    expect(
      screen.queryByRole("group", { name: t("note.ask_when") }),
    ).toBeNull();
    expect(screen.getByText("Tomorrow · No date")).toBeTruthy();
  });

  it("lists skipped text with its reason", () => {
    open(
      resultOf(
        [sql],
        [
          { ref: "s1", text: "fyi lab moved to room 3", reason: "skip" },
          { ref: "s2", text: "Email Prof. Kim", reason: "already_done" },
          { ref: "s3", text: "gym", reason: "not_found" },
          { ref: "s4", text: "HCI quiz", reason: "no_change" },
        ],
      ),
    );
    expect(screen.getByText("Already set: “HCI quiz”")).toBeTruthy();
    expect(screen.getByText(t("note.skipped"))).toBeTruthy();
    expect(screen.getByText("fyi lab moved to room 3")).toBeTruthy();
    expect(screen.getByText("Already done: “Email Prof. Kim”")).toBeTruthy();
    expect(
      screen.getByText("Couldn't find a task matching “gym”"),
    ).toBeTruthy();
  });

  it("names the file a note came from", () => {
    open(resultOf([sql], [], { source_file_name: "week7.pdf" }));
    expect(screen.getByText("From week7.pdf")).toBeTruthy();
  });

  it("a long note is quoted short, with Show all", async () => {
    open(resultOf([sql], [], { text: "word ".repeat(60) }));
    const toggle = screen.getByRole("button", { name: "Show all" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(toggle);
    expect(
      screen
        .getByRole("button", { name: "Show less" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("a short note has no Show all", () => {
    open(resultOf([sql]));
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("A11Y-20: focus is on the heading, and its name includes the overline", () => {
    open(resultOf([sql]));
    const heading = screen.getByRole("heading", { level: 1 });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute("aria-labelledby")?.split(" ")).toHaveLength(2);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Today 08:12 · 1 task made This week",
      }),
    ).toBeTruthy();
  });

  it("A11Y-21: a row's name reads the badge, the title and the meta", () => {
    open(resultOf([sql]));
    expect(
      screen.getByRole("link", {
        name: "Created: SQL quiz, Mon 26 Oct · 09:00 · SQL Course",
      }),
    ).toBeTruthy();
  });

  it("falls back to the first words while the note has no name", () => {
    open(
      resultOf([sql], [], {
        name: null,
        text: "one two three four five six seven",
      }),
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "one two three four five six",
    );
  });

  it("Back leaves the screen; there is no Done button (the panel has its own Close)", async () => {
    const { onDone } = open(resultOf([sql]));
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("is axe clean in both themes", async () => {
    open(
      resultOf(
        [sql, hci, old, ink],
        [{ ref: "s1", text: "fyi lab moved", reason: "skip" }],
      ),
    );
    await expectAxeCleanInBothThemes();
  });

  describe("Undo all (IM-44, RV-2)", () => {
    it("offers Undo all next to Done and asks to undo without confirming", async () => {
      const { onUndo } = open(resultOf([sql]));
      await userEvent.click(
        screen.getByRole("button", { name: t("note.undo_all") }),
      );
      expect(onUndo).toHaveBeenCalledWith(false);
    });

    it("T-RV-12: an undone note says Pending, mutes its rows and hides Undo all", () => {
      open(resultOf([sql, ink], [], { status: "pending" }));
      expect(screen.getByText("Today 08:12 · Pending")).toBeTruthy();
      expect(screen.queryByText(t("note.result_hint"))).toBeNull();
      expect(
        screen.queryByRole("button", { name: t("note.undo_all") }),
      ).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
      expect(
        screen.queryByRole("group", { name: t("note.ask_when") }),
      ).toBeNull();
    });

    it("T-RV-103: a task brought back without its deleted project says so", () => {
      const inProject: NoteChange = {
        ...old,
        task: { ...old.task, project_id: "p-gone" },
      };
      open(resultOf([inProject, sql], [], { status: "pending" }), {
        live: { "t-old": { ...old.task, project_id: null } },
      });
      expect(screen.getByText(t("note.project_gone"))).toBeTruthy();
    });

    it("A11Y-23: after Undo all focus moves to the heading, read with its overline", () => {
      const { rerender } = render(<main />);
      const props = {
        today: TODAY,
        now: NOW,
        timeZone: "Asia/Ho_Chi_Minh",
        timeFormat: "24h" as const,
        weekStart: "mon" as const,
        onDone: vi.fn(),
        onSetDue: vi.fn(),
        onUndo: vi.fn(),
      };
      rerender(<NoteResultScreen result={resultOf([sql])} {...props} />);
      screen.getByRole("button", { name: t("note.undo_all") }).focus();
      rerender(
        <NoteResultScreen
          result={resultOf([sql], [], { status: "pending" })}
          {...props}
        />,
      );
      expect(document.activeElement).toBe(
        screen.getByRole("heading", {
          level: 1,
          name: "Today 08:12 · Pending This week",
        }),
      );
    });

    it("RV-E2: after 30 days the note shows note.undo_expired instead of Undo all", () => {
      open(resultOf([sql], [], { processed_at: "2026-09-20T08:12:01+07:00" }));
      expect(screen.getByText(t("note.undo_expired"))).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: t("note.undo_all") }),
      ).toBeNull();
    });

    it("RV-E17: Edit note is offered on a done note, and not after 30 days", async () => {
      const onEdit = vi.fn();
      open(resultOf([sql]), { onEdit });
      await userEvent.click(
        screen.getByRole("button", { name: t("note.edit") }),
      );
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it("RV-E17: after 30 days Edit note is not shown", () => {
      open(resultOf([sql], [], { processed_at: "2026-09-20T08:12:01+07:00" }), {
        onEdit: vi.fn(),
      });
      expect(screen.queryByRole("button", { name: t("note.edit") })).toBeNull();
    });

    it("RV-E17: Edit note is offered on a pending note", () => {
      open(resultOf([sql], [], { status: "pending" }), { onEdit: vi.fn() });
      expect(screen.getByRole("button", { name: t("note.edit") })).toBeTruthy();
    });

    it("RV §2.4: a pending note offers Make tasks again, which replans it", async () => {
      const onReplan = vi.fn();
      open(resultOf([sql], [], { status: "pending" }), {
        onEdit: vi.fn(),
        onReplan,
      });
      await userEvent.click(
        screen.getByRole("button", { name: t("note.replan") }),
      );
      expect(onReplan).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: t("note.edit") })).toBeTruthy();
    });

    it("offers no Make tasks again on a done note", () => {
      open(resultOf([sql]), { onReplan: vi.fn() });
      expect(
        screen.queryByRole("button", { name: t("note.replan") }),
      ).toBeNull();
    });

    it("offline, Undo all is disabled and says it needs a connection", () => {
      open(resultOf([sql]), { offline: true });
      expect(
        (
          screen.getByRole("button", {
            name: t("note.undo_all"),
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(screen.getByText(t("note.needs_connection"))).toBeTruthy();
    });

    it("conflicts open the dialog: Undo all confirms, Cancel closes", async () => {
      const { onUndo, onCancelUndo } = open(resultOf([sql]), { conflicts: 2 });
      const dialog = screen.getByRole("alertdialog");
      expect(
        within(dialog).getByText(t("note.undo_conflict_body", { count: 2 })),
      ).toBeTruthy();
      await userEvent.click(
        within(dialog).getByRole("button", { name: t("note.undo_all") }),
      );
      expect(onUndo).toHaveBeenCalledWith(true);
      await userEvent.click(
        within(dialog).getByRole("button", { name: t("common.cancel") }),
      );
      expect(onCancelUndo).toHaveBeenCalled();
    });

    it("is axe clean undone, and with the dialog open", async () => {
      open(resultOf([sql, hci, old], [], { status: "pending" }), {
        conflicts: 1,
      });
      await expectAxeCleanInBothThemes();
    });
  });
});

describe("Check this first (IM-45, NU-5)", () => {
  const confirm = (changes: NoteChange[]) =>
    resultOf(changes, [], { status: "confirm" });

  it("counts the changes to apply with the right plural", () => {
    open(confirm([sql]));
    expect(screen.getByText("1 change to apply")).toBeTruthy();
  });

  it("T-RV-40: says nothing happens yet, lists the rows, and offers Edit note and Apply changes", () => {
    open(confirm([sql, old]));
    expect(screen.getByText(t("note.review_title"))).toBeTruthy();
    expect(
      screen.getByText(t("note.confirm_body_other", { count: 2 })),
    ).toBeTruthy();
    expect(screen.getByText("SQL quiz")).toBeTruthy();
    expect(screen.getByRole("button", { name: t("note.edit") })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t("note.apply_preview") }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("a row opens the planned task here, not its page, and an undated one asks When?", async () => {
    const onOpenTask = vi.fn();
    open(confirm([sql, ink, old]), { onOpenTask });
    expect(screen.queryByRole("link")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /SQL quiz/ }));
    expect(onOpenTask).toHaveBeenCalledWith(sql.task);
    expect(
      screen.queryByRole("button", { name: /Old reading list/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("group", { name: t("note.ask_when") }),
    ).toBeNull();
  });

  it("a row rescheduled here shows its new date instead of the note's", () => {
    open(confirm([sql]), {
      onOpenTask: vi.fn(),
      live: {
        "t-sql": {
          ...sql.task,
          start_date: "2026-10-30",
          due_date: "2026-10-30",
          start_time: "14:00",
        },
      },
    });
    expect(screen.getByText(/Fri 30 Oct, 14:00/)).toBeTruthy();
  });

  it("Apply changes and Edit note hand over", async () => {
    const onApply = vi.fn();
    const onEdit = vi.fn();
    open(confirm([sql]), { onApply, onEdit });
    await userEvent.click(
      screen.getByRole("button", { name: t("note.apply_preview") }),
    );
    await userEvent.click(screen.getByRole("button", { name: t("note.edit") }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("offline: both are disabled and say why", () => {
    open(confirm([sql]), { offline: true });
    expect(screen.getByText(t("note.needs_connection"))).toBeTruthy();
    for (const name of [t("note.apply_preview"), t("note.edit")])
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
  });

  it("is axe clean in both themes", async () => {
    open(confirm([sql, hci, old]));
    await expectAxeCleanInBothThemes();
  });
});

describe("Follow-up (IM-46, RV-3)", () => {
  const followup = resultOf([], [], {
    status: "followup",
    text: "idea: garden\nfyi: a long thought ".repeat(10),
  });

  it("T-RV-20: shows the question, the full quote and both actions with heading focus", () => {
    open(followup);
    const heading = screen.getByRole("heading", {
      name: t("note.followup_title"),
      level: 1,
    });
    expect(document.activeElement).toBe(heading);
    expect(
      screen.getByText(followup.note.text.replace(/\s+/g, " ").trim()),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t("note.make_one") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t("note.followup_edit") }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("common.done") })).toBeNull();
    expect(screen.queryByText(t("note.show_all"))).toBeNull();
  });

  it("calls the selected action (T-RV-22, T-RV-23)", async () => {
    const make = vi.fn();
    const edit = vi.fn();
    open(followup, { onMakeTask: make, onEdit: edit });
    await userEvent.click(
      screen.getByRole("button", { name: t("note.followup_edit") }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: t("note.make_one") }),
    );
    expect(make).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledOnce();
  });

  it.each([{ offline: true }, { busy: true }])(
    "disables both actions while unavailable: %j",
    (state) => {
      open(followup, state);
      expect(
        (
          screen.getByRole("button", {
            name: t("note.followup_edit"),
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        (
          screen.getByRole("button", {
            name: t("note.make_one"),
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    },
  );

  it("has no axe violations in either theme", async () => {
    open(followup);
    await expectAxeCleanInBothThemes();
  });
  it("opens delete confirmation dialog and triggers onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <NoteResultScreen
        result={resultOf([sql])}
        onDone={() => {}}
        onSetDue={() => {}}
        onDelete={onDelete}
        today={TODAY}
        now={NOW}
        timeZone="Asia/Ho_Chi_Minh"
        timeFormat="24h"
        weekStart="mon"
      />,
    );
    const deleteBtn = screen.getByRole("button", { name: t("note.delete") });
    await userEvent.click(deleteBtn);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(
      screen.getByText(t("note.delete_title", { name: "This week" })),
    ).toBeTruthy();
    const confirmBtn = within(screen.getByRole("alertdialog")).getByRole(
      "button",
      {
        name: t("common.delete"),
      },
    );
    await userEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
