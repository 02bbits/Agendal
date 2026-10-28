import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AppShell,
  SEARCH_DEBOUNCE_MS,
  SearchScreen,
  highlightParts,
  normalize,
  searchTasks,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { setup } from "./harness";

const corpus = () => [
  task({
    title: "Bài tập SQL tuần 5",
    due_date: "2026-10-28",
    project_id: "p-sql",
  }),
  task({ title: "Meet at café", due_date: "2026-10-25" }),
  task({
    title: "Draw ER diagram",
    due_date: "2026-10-30",
    notes: "for the SQL course",
  }),
  task({
    title: "Prepare slides",
    notes: "include the ER diagram",
    due_date: "2026-10-24",
  }),
  task({
    title: "ER diagram draft",
    done: true,
    done_at: "2026-10-20T08:00:00Z",
    due_date: "2026-10-20",
  }),
  task({ title: '100% done_check "quoted"' }),
];

describe("searchTasks (LV-3)", () => {
  it("normalizes case and Vietnamese accents both ways (LV-E5, T-LV-105)", () => {
    expect(normalize("Bài tập Đồ án")).toBe("bai tap do an");
    const titles = (q: string) =>
      searchTasks(corpus(), q, "all").items.map((x) => x.title);
    expect(titles("bai tap")).toEqual(["Bài tập SQL tuần 5"]);
    expect(titles("BÀI TẬP")).toEqual(["Bài tập SQL tuần 5"]);
    expect(titles("cafe")).toEqual(["Meet at café"]);
  });

  it("covers titles and notes, completed included, every word in any order (T-LV-20)", () => {
    expect(
      searchTasks(corpus(), "diagram er", "all").items.map((x) => x.title),
    ).toEqual(["Draw ER diagram", "ER diagram draft", "Prepare slides"]);
    expect(
      searchTasks(corpus(), "sql course", "all").items.map((x) => x.title),
    ).toEqual(["Draw ER diagram"]);
  });

  it("ranks title matches first, then open before completed, then soonest due (T-LV-107, LV-E7)", () => {
    // "Draw ER diagram" matches in title and notes: listed once, as a title match
    const items = searchTasks(corpus(), "er diagram", "all").items;
    expect(items.map((x) => x.title)).toEqual([
      "Draw ER diagram",
      "ER diagram draft",
      "Prepare slides",
    ]);
    expect(new Set(items.map((x) => x.id)).size).toBe(items.length);
  });

  it("counts All / Open / Completed for the query, whatever the chip (T-LV-21)", () => {
    const result = searchTasks(corpus(), "diagram", "completed");
    expect(result.counts).toEqual({ all: 3, open: 2, completed: 1 });
    expect(result.items.map((x) => x.title)).toEqual(["ER diagram draft"]);
  });

  it("treats % _ and quotes as literal text (LV-E6, T-LV-106)", () => {
    expect(searchTasks(corpus(), "100%", "all").items).toHaveLength(1);
    expect(searchTasks(corpus(), "done_check", "all").items).toHaveLength(1);
    expect(searchTasks(corpus(), '"quoted"', "all").items).toHaveLength(1);
    expect(searchTasks(corpus(), "%", "all").items).toHaveLength(1);
    expect(searchTasks(corpus(), "_", "all").items).toHaveLength(1);
  });

  it("highlights matched words as text parts, accent-insensitive", () => {
    expect(highlightParts("Bài tập SQL", "bai")).toEqual([
      { text: "Bài", match: true },
      { text: " tập SQL", match: false },
    ]);
    expect(highlightParts("<b>x</b>", "b")).toEqual([
      { text: "<", match: false },
      { text: "b", match: true },
      { text: ">x</", match: false },
      { text: "b", match: true },
      { text: ">", match: false },
    ]);
  });
});

describe("Search screen", () => {
  const type = async (text: string) => {
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: text },
    });
    await act(async () => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
  };

  it("focuses the field, shows the hint, then results after 250 ms with counts", async () => {
    vi.useFakeTimers();
    try {
      const { wrap } = setup(corpus());
      render(wrap(<SearchScreen onBack={() => {}} />));
      expect(document.activeElement).toBe(screen.getByRole("searchbox"));
      expect(
        screen.getByRole("heading", { name: "Search titles and notes" }),
      ).toBeTruthy();
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "diagram" },
      });
      await act(async () => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
      await act(async () => vi.advanceTimersByTime(1));
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
      const group = screen.getByRole("radiogroup", { name: "Status" });
      expect(
        within(group)
          .getAllByRole("radio")
          .map((r) => r.textContent),
      ).toEqual(["All 3", "Open 2", "Completed 1"]);
      expect(screen.getByText("3 results").getAttribute("aria-live")).toBe(
        "polite",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("bolds matched words in titles", async () => {
    vi.useFakeTimers();
    try {
      const { wrap } = setup(corpus());
      render(wrap(<SearchScreen onBack={() => {}} />));
      await type("bai");
      const marks = document.querySelectorAll('[data-slot="title"] mark');
      expect([...marks].map((m) => m.textContent)).toEqual(["Bài"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs at once on Enter", async () => {
    const { wrap } = setup(corpus());
    render(wrap(<SearchScreen onBack={() => {}} />));
    await userEvent.type(screen.getByRole("searchbox"), "cafe{Enter}");
    expect(screen.getByRole("link", { name: /^Meet at café,/ })).toBeTruthy();
  });

  it('says "No tasks match “…”" (T-LV-22)', async () => {
    vi.useFakeTimers();
    try {
      const { wrap } = setup(corpus());
      render(wrap(<SearchScreen onBack={() => {}} />));
      await type("zebra");
      expect(
        screen.getByRole("heading", { name: "No tasks match “zebra”" }),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("notes offline results come from the device", async () => {
    const { wrap } = setup(corpus());
    render(wrap(<SearchScreen onBack={() => {}} offline />));
    await userEvent.type(screen.getByRole("searchbox"), "sql{Enter}");
    expect(
      screen.getByText("Showing results saved on this device"),
    ).toBeTruthy();
  });

  it("is axe clean with results", async () => {
    const { wrap } = setup(corpus());
    render(wrap(<SearchScreen onBack={() => {}} />));
    await userEvent.type(screen.getByRole("searchbox"), "diagram{Enter}");
    await expectAxeCleanInBothThemes();
  });

  it("`/` on a list screen opens Search unless a field has focus (UX-12)", async () => {
    const navigate = vi.fn(() => true);
    render(
      <AppShell tab="inbox" navigate={navigate}>
        <input aria-label="other" />
      </AppShell>,
    );
    await userEvent.keyboard("/");
    expect(navigate).toHaveBeenCalledWith("/search");
    navigate.mockClear();
    screen.getByRole("textbox", { name: "other" }).focus();
    await userEvent.keyboard("/");
    expect(navigate).not.toHaveBeenCalled();
  });
});
