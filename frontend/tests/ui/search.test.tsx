import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AppShell,
  highlightParts,
  normalize,
  SearchPanel,
  SearchPopup,
  searchProjects,
  searchTasks,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SETTLE_MS,
} from "../../src/ui";
import { clearRecent, readRecent } from "../../src/ui/domain/recentSearches";
import type { Project, Task } from "../../src/ui/domain/types";
import { task } from "./fixtures";

const corpus = (): Task[] => [
  task({
    id: "t-1",
    title: "Bài tập SQL tuần 5",
    due_date: "2026-10-28",
    project_id: "p-sql",
  }),
  task({ id: "t-2", title: "Meet at café", due_date: "2026-10-25" }),
  task({
    id: "t-3",
    title: "Draw ER diagram",
    due_date: "2026-10-30",
    notes: "for the SQL course",
  }),
  task({
    id: "t-4",
    title: "Prepare slides",
    notes: "include the ER diagram",
    due_date: "2026-10-24",
  }),
  task({
    id: "t-5",
    title: "ER diagram draft",
    done: true,
    done_at: "2026-10-20T08:00:00Z",
    due_date: "2026-10-20",
  }),
  task({ id: "t-6", title: '100% done_check "quoted"' }),
];

const mockProjects: Project[] = [
  {
    id: "p-sql",
    name: "SQL Course",
    colour: "blue",
    created_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "p-cafe",
    name: "Café Meetups",
    colour: "green",
    created_at: "2026-10-01T00:00:00Z",
  },
];

describe("searchTasks (domain/search)", () => {
  it("normalizes case and Vietnamese accents both ways", () => {
    expect(normalize("Bài tập Đồ án")).toBe("bai tap do an");
    const titles = (q: string) =>
      searchTasks(corpus(), q, "all").items.map((x) => x.title);
    expect(titles("bai tap")).toEqual(["Bài tập SQL tuần 5"]);
    expect(titles("BÀI TẬP")).toEqual(["Bài tập SQL tuần 5"]);
    expect(titles("cafe")).toEqual(["Meet at café"]);
  });

  it("covers titles and notes, completed included, every word in any order", () => {
    expect(
      searchTasks(corpus(), "diagram er", "all").items.map((x) => x.title),
    ).toEqual(["Draw ER diagram", "ER diagram draft", "Prepare slides"]);
    expect(
      searchTasks(corpus(), "sql course", "all").items.map((x) => x.title),
    ).toEqual(["Draw ER diagram"]);
  });

  it("ranks title matches first, then open before completed, then soonest due", () => {
    const items = searchTasks(corpus(), "er diagram", "all").items;
    expect(items.map((x) => x.title)).toEqual([
      "Draw ER diagram",
      "ER diagram draft",
      "Prepare slides",
    ]);
  });

  it("counts All / Open / Completed for the query", () => {
    const result = searchTasks(corpus(), "diagram", "completed");
    expect(result.counts).toEqual({ all: 3, open: 2, completed: 1 });
    expect(result.items.map((x) => x.title)).toEqual(["ER diagram draft"]);
  });

  it("highlights matched words as text parts, accent-insensitive", () => {
    expect(highlightParts("Bài tập SQL", "bai")).toEqual([
      { text: "Bài", match: true },
      { text: " tập SQL", match: false },
    ]);
  });

  const mustPassTexts = [
    "Bài tập SQL",
    "Bãi biển Nha Trang",
    "Bai tap tieng Anh",
    "Họp nhóm hoà giải",
    "Hòa nhạc tối nay",
    "Adv Web report: outline",
    "Update CV and portfolio links",
    "Thuỷ điện Sơn La",
    "Đồ án tốt nghiệp",
    "Ứng dụng di động",
    "Research PostgreSQL unaccent",
    "Learn UI/UX",
    "Meet at café",
  ];

  const mustPassTasks = mustPassTexts.map((title, i) =>
    task({ id: `mp-${i}`, title }),
  );

  const mustPassTable: Array<{
    query: string;
    finds: string[];
    mustNotFind: string[];
  }> = [
    {
      query: "à ứ ừ ư",
      finds: [],
      mustNotFind: mustPassTexts,
    },
    {
      query: "ứ",
      finds: ["Ứng dụng di động"],
      mustNotFind: ["Update CV and portfolio links", "Learn UI/UX"],
    },
    {
      query: "u",
      finds: [
        "Update CV and portfolio links",
        "Research PostgreSQL unaccent",
        "Learn UI/UX",
        "Ứng dụng di động",
      ],
      mustNotFind: ["Adv Web report: outline", "Bài tập SQL"],
    },
    {
      query: "a",
      finds: [
        "Adv Web report: outline",
        "Update CV and portfolio links",
        "Bai tap tieng Anh",
        "Đồ án tốt nghiệp",
        "Meet at café",
      ],
      mustNotFind: ["Research PostgreSQL unaccent"],
    },
    {
      query: "bai",
      finds: ["Bài tập SQL", "Bãi biển Nha Trang", "Bai tap tieng Anh"],
      mustNotFind: [],
    },
    {
      query: "bài",
      finds: ["Bài tập SQL", "Bai tap tieng Anh"],
      mustNotFind: ["Bãi biển Nha Trang"],
    },
    {
      query: "bài tập",
      finds: ["Bài tập SQL", "Bai tap tieng Anh"],
      mustNotFind: [],
    },
    {
      query: "hoà",
      finds: ["Họp nhóm hoà giải", "Hòa nhạc tối nay"],
      mustNotFind: [],
    },
    {
      query: "hòa",
      finds: ["Họp nhóm hoà giải", "Hòa nhạc tối nay"],
      mustNotFind: [],
    },
    {
      query: "thủy",
      finds: ["Thuỷ điện Sơn La"],
      mustNotFind: [],
    },
    {
      query: "thuỷ",
      finds: ["Thuỷ điện Sơn La"],
      mustNotFind: [],
    },
    {
      query: "do an",
      finds: ["Đồ án tốt nghiệp"],
      mustNotFind: [],
    },
    {
      query: "đồ án",
      finds: ["Đồ án tốt nghiệp"],
      mustNotFind: [],
    },
    {
      query: "ĐỒ ÁN",
      finds: ["Đồ án tốt nghiệp"],
      mustNotFind: [],
    },
    {
      query: "ung dung",
      finds: ["Ứng dụng di động"],
      mustNotFind: [],
    },
    {
      query: "sql",
      finds: ["Bài tập SQL", "Research PostgreSQL unaccent"],
      mustNotFind: [],
    },
    {
      query: "cafe",
      finds: ["Meet at café"],
      mustNotFind: [],
    },
    {
      query: "café",
      finds: ["Meet at café"],
      mustNotFind: [],
    },
    {
      query: "ui/ux",
      finds: ["Learn UI/UX"],
      mustNotFind: [],
    },
  ];

  it.each(mustPassTable)(
    "matches Vietnamese search table query: $query",
    ({ query, finds, mustNotFind }) => {
      const items = searchTasks(mustPassTasks, query, "all").items;
      const titles = items.map((x) => x.title);
      if (finds.length === 0) {
        expect(titles).toEqual([]);
      } else {
        for (const f of finds) {
          expect(titles).toContain(f);
        }
      }
      for (const nf of mustNotFind) {
        expect(titles).not.toContain(nf);
      }
    },
  );

  it("filters searchProjects across must-pass table rows", () => {
    const projects = mustPassTexts.map((name, i) => ({ id: `p-${i}`, name }));

    const res1 = searchProjects(projects, "do an").map((p) => p.name);
    expect(res1).toContain("Đồ án tốt nghiệp");

    const res2 = searchProjects(projects, "hoà").map((p) => p.name);
    expect(res2).toContain("Họp nhóm hoà giải");
    expect(res2).toContain("Hòa nhạc tối nay");

    const res3 = searchProjects(projects, "bài").map((p) => p.name);
    expect(res3).toContain("Bài tập SQL");
    expect(res3).toContain("Bai tap tieng Anh");
    expect(res3).not.toContain("Bãi biển Nha Trang");
  });

  it("highlights parts with exact rules", () => {
    // u on Update outline marks only the first U
    expect(highlightParts("Update outline", "u")).toEqual([
      { text: "U", match: true },
      { text: "pdate outline", match: false },
    ]);

    // sql on PostgreSQL marks SQL
    expect(highlightParts("PostgreSQL", "sql")).toEqual([
      { text: "Postgre", match: false },
      { text: "SQL", match: true },
    ]);

    // hòa on Họp hoà giải marks hoà
    expect(highlightParts("Họp hoà giải", "hòa")).toEqual([
      { text: "Họp ", match: false },
      { text: "hoà", match: true },
      { text: " giải", match: false },
    ]);

    // bài on Bãi marks nothing
    expect(highlightParts("Bãi", "bài")).toEqual([
      { text: "Bãi", match: false },
    ]);
  });
});

describe("SearchPanel & SearchPopup", () => {
  it("shows skeleton on the same tick, and no_match is NOT in doc before answer + 200ms", async () => {
    vi.useFakeTimers();
    try {
      const searchTasksMock = vi.fn().mockImplementation(async () => ({
        items: [],
        counts: { all: 0, open: 0, completed: 0 },
        next_cursor: null,
      }));
      const searchNotesMock = vi.fn().mockImplementation(async () => ({
        items: [],
      }));

      render(
        <SearchPanel
          variant="popup"
          projects={mockProjects}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={searchTasksMock}
          searchNotes={searchNotesMock}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "zebra" } });

      // On the same tick: skeleton is present immediately, no_match is NOT in document
      expect(screen.getByRole("status", { busy: true })).toBeTruthy();
      expect(screen.queryByText(/Nothing matches/)).toBeNull();

      // Advance by debounce time - 1
      await act(async () => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
      });
      expect(screen.getByRole("status", { busy: true })).toBeTruthy();
      expect(screen.queryByText(/Nothing matches/)).toBeNull();

      // Trigger debounce execution
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      // Response answered, but settle time (200ms) has not elapsed
      await act(async () => {
        vi.advanceTimersByTime(SEARCH_SETTLE_MS - 1);
      });
      expect(screen.getByRole("status", { busy: true })).toBeTruthy();
      expect(screen.queryByText(/Nothing matches/)).toBeNull();

      // Settle time completes (200ms)
      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.queryByRole("status", { busy: true })).toBeNull();
      expect(screen.getByText(/Nothing matches/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not allow a slow old answer to replace a newer query", async () => {
    vi.useFakeTimers();
    try {
      let resolveFirst: (val: unknown) => void = () => {};
      const firstPromise = new Promise((res) => {
        resolveFirst = res;
      });

      const searchTasksMock = vi.fn().mockImplementation(async ({ q }) => {
        if (q === "first") {
          return firstPromise;
        }
        return {
          items: [task({ id: "t-second", title: "Second Task" })],
          counts: { all: 1, open: 1, completed: 0 },
          next_cursor: null,
        };
      });

      render(
        <SearchPanel
          variant="popup"
          projects={mockProjects}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={searchTasksMock}
          searchNotes={async () => ({ items: [] })}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      const input = screen.getByRole("combobox");

      // Type "first"
      fireEvent.change(input, { target: { value: "first" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      });

      // Type "second" while first is still pending
      fireEvent.change(input, { target: { value: "second" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      });

      // Query "second" answers and settles
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS);
      });
      expect(screen.getByRole("option", { name: /Second Task/i })).toBeTruthy();

      // First query finally resolves
      await act(async () => {
        resolveFirst({
          items: [task({ id: "t-first", title: "First Task" })],
          counts: { all: 1, open: 1, completed: 0 },
          next_cursor: null,
        });
        await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS);
      });

      // The second query result is preserved; first does not overwrite it
      expect(screen.getByRole("option", { name: /Second Task/i })).toBeTruthy();
      expect(screen.queryByRole("option", { name: /First Task/i })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends one request per pause and Enter runs at once", async () => {
    vi.useFakeTimers();
    try {
      const searchTasksMock = vi.fn().mockResolvedValue({
        items: [],
        counts: { all: 0, open: 0, completed: 0 },
        next_cursor: null,
      });

      render(
        <SearchPanel
          variant="popup"
          projects={mockProjects}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={searchTasksMock}
          searchNotes={async () => ({ items: [] })}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      const input = screen.getByRole("combobox");

      // Keystrokes spaced by 50ms (less than 250ms debounce)
      fireEvent.change(input, { target: { value: "a" } });
      await act(async () => vi.advanceTimersByTime(50));
      fireEvent.change(input, { target: { value: "ab" } });
      await act(async () => vi.advanceTimersByTime(50));
      fireEvent.change(input, { target: { value: "abc" } });
      await act(async () => vi.advanceTimersByTime(50));

      expect(searchTasksMock).not.toHaveBeenCalled();

      // Debounce completes
      await act(async () => vi.advanceTimersByTime(200));
      expect(searchTasksMock).toHaveBeenCalledTimes(1);
      expect(searchTasksMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: "abc" }),
      );

      // Enter runs at once (flushSeq)
      searchTasksMock.mockClear();
      fireEvent.change(input, { target: { value: "instant" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await act(async () => vi.advanceTimersByTime(0));

      expect(searchTasksMock).toHaveBeenCalledTimes(1);
      expect(searchTasksMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: "instant" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders Tasks, Projects, Notes sections with <mark> around matched text", async () => {
    vi.useFakeTimers();
    try {
      const searchTasksMock = vi.fn().mockResolvedValue({
        items: [task({ id: "t-1", title: "Bài tập toán học" })],
        counts: { all: 1, open: 1, completed: 0 },
        next_cursor: null,
      });
      const searchNotesMock = vi.fn().mockResolvedValue({
        items: [
          {
            id: "n-1",
            title: "Ghi chú bài tập",
            snippet: "Nội dung bài tập quan trọng",
            status: "done",
            written_at: "2026-10-23T08:00:00Z",
          },
        ],
      });
      const projects: Project[] = [
        {
          id: "p-1",
          name: "Dự án bài tập",
          colour: "blue",
          created_at: "2026-10-01T00:00:00Z",
        },
      ];

      render(
        <SearchPanel
          variant="popup"
          projects={projects}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={searchTasksMock}
          searchNotes={searchNotesMock}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "bai tap" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SEARCH_DEBOUNCE_MS + SEARCH_SETTLE_MS,
        );
      });

      expect(screen.getByText("Tasks")).toBeTruthy();
      expect(screen.getByText("Projects")).toBeTruthy();
      expect(screen.getByText("Notes")).toBeTruthy();

      const marks = document.querySelectorAll("mark");
      expect(marks.length).toBeGreaterThan(0);
      const markTexts = [...marks].map((m) => m.textContent);
      expect(markTexts).toContain("Bài tập");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the Notes section, empty, when only tasks match", async () => {
    vi.useFakeTimers();
    try {
      render(
        <SearchPanel
          variant="popup"
          projects={[]}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={vi.fn().mockResolvedValue({
            items: [task({ id: "t-1", title: "Quiz" })],
            counts: { all: 1, open: 1, completed: 0 },
            next_cursor: null,
          })}
          searchNotes={vi.fn().mockResolvedValue({ items: [] })}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "quiz" },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SEARCH_DEBOUNCE_MS + SEARCH_SETTLE_MS,
        );
      });
      expect(screen.getByText("No notes found")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the Notes section for a quick filter", async () => {
    vi.useFakeTimers();
    try {
      render(
        <SearchPanel
          variant="popup"
          projects={[]}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={vi.fn().mockResolvedValue({
            items: [task({ id: "t-1", title: "Quiz" })],
            counts: { all: 1, open: 1, completed: 0 },
            next_cursor: null,
          })}
          searchNotes={vi.fn().mockResolvedValue({ items: [] })}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Overdue" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SEARCH_DEBOUNCE_MS + SEARCH_SETTLE_MS,
        );
      });
      expect(screen.getByText("Quiz")).toBeTruthy();
      expect(screen.queryByText("No notes found")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tab chips filter sections and show counts with no numbers while pending", async () => {
    vi.useFakeTimers();
    try {
      const searchTasksMock = vi.fn().mockResolvedValue({
        items: [task({ id: "t-1", title: "Task Item" })],
        counts: { all: 1, open: 1, completed: 0 },
        next_cursor: null,
      });
      const searchNotesMock = vi.fn().mockResolvedValue({
        items: [
          {
            id: "n-1",
            title: "Note Item",
            snippet: "Snippet text",
            status: "done",
            written_at: "2026-10-23T08:00:00Z",
          },
        ],
      });
      const projects: Project[] = [
        {
          id: "p-1",
          name: "Project Item",
          colour: "blue",
          created_at: "2026-10-01T00:00:00Z",
        },
      ];

      render(
        <SearchPanel
          variant="popup"
          projects={projects}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={searchTasksMock}
          searchNotes={searchNotesMock}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "Item" } });

      // While pending: tabs have no numbers
      expect(screen.getByRole("tab", { name: "All" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Tasks" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Projects" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Notes" })).toBeTruthy();

      // Settle
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SEARCH_DEBOUNCE_MS + SEARCH_SETTLE_MS,
        );
      });

      // Settled: counts are displayed
      expect(screen.getByRole("tab", { name: "All 3" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Tasks 1" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Projects 1" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Notes 1" })).toBeTruthy();

      // Switch to Tasks tab
      fireEvent.click(screen.getByRole("tab", { name: "Tasks 1" }));
      expect(screen.getByText("Tasks")).toBeTruthy();
      expect(screen.queryByText("Projects")).toBeNull();
      expect(screen.queryByText("Notes")).toBeNull();

      // Switch to Projects tab
      fireEvent.click(screen.getByRole("tab", { name: "Projects 1" }));
      expect(screen.queryByText("Tasks")).toBeNull();
      expect(screen.getByText("Projects")).toBeTruthy();
      expect(screen.queryByText("Notes")).toBeNull();

      // Switch to Notes tab
      fireEvent.click(screen.getByRole("tab", { name: "Notes 1" }));
      expect(screen.queryByText("Tasks")).toBeNull();
      expect(screen.queryByText("Projects")).toBeNull();
      expect(screen.getByText("Notes")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles quick filters, completed status, and project chip", async () => {
    vi.useFakeTimers();
    try {
      const searchTasksMock = vi.fn().mockResolvedValue({
        items: [],
        counts: { all: 0, open: 0, completed: 0 },
        next_cursor: null,
      });

      render(
        <SearchPanel
          variant="popup"
          projects={mockProjects}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={searchTasksMock}
          searchNotes={async () => ({ items: [] })}
          onOpenTask={() => {}}
          onOpenProject={() => {}}
          onOpenNote={() => {}}
        />,
      );

      // Click Overdue chip
      fireEvent.click(screen.getByRole("button", { name: "Overdue" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      });
      expect(searchTasksMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: "", filter: "overdue", status: "all" }),
      );

      // Clear active filter to return to home chips
      fireEvent.click(screen.getByText("Overdue"));

      // Click Completed chip
      searchTasksMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "Completed" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      });
      expect(searchTasksMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: "", status: "completed" }),
      );

      // Clear active filter
      fireEvent.click(screen.getByText("Completed"));

      // Click Project chip
      searchTasksMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "SQL Course" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      });
      expect(searchTasksMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: "", project_id: "p-sql", status: "all" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles recent searches: added on Enter, removed, cleared, hidden when empty", async () => {
    clearRecent();
    const searchTasksMock = vi.fn().mockResolvedValue({
      items: [],
      counts: { all: 0, open: 0, completed: 0 },
      next_cursor: null,
    });

    const { unmount } = render(
      <SearchPanel
        variant="popup"
        projects={mockProjects}
        today="2026-10-23"
        timeFormat="24h"
        searchTasks={searchTasksMock}
        searchNotes={async () => ({ items: [] })}
        onOpenTask={() => {}}
        onOpenProject={() => {}}
        onOpenNote={() => {}}
      />,
    );

    // Hidden when empty
    expect(screen.queryByText("Recent searches")).toBeNull();

    // Typing does not add to recent
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "learn react" } });
    expect(readRecent()).toEqual([]);

    // Pressing Enter adds to recent
    fireEvent.keyDown(input, { key: "Enter" });
    expect(readRecent()).toEqual(["learn react"]);

    unmount();

    // Remount to view recent searches
    render(
      <SearchPanel
        variant="popup"
        projects={mockProjects}
        today="2026-10-23"
        timeFormat="24h"
        searchTasks={searchTasksMock}
        searchNotes={async () => ({ items: [] })}
        onOpenTask={() => {}}
        onOpenProject={() => {}}
        onOpenNote={() => {}}
      />,
    );

    expect(screen.getByText("Recent searches")).toBeTruthy();
    expect(screen.getByText("learn react")).toBeTruthy();

    // Remove item
    const removeBtn = screen.getByRole("button", {
      name: "Remove learn react",
    });
    fireEvent.click(removeBtn);
    expect(readRecent()).toEqual([]);
    expect(screen.queryByText("learn react")).toBeNull();
  });

  it("handles popup backdrop click, inner click, Esc close, and no bad badges", () => {
    const onClose = vi.fn();
    render(
      <SearchPopup
        clock={{ now: () => new Date("2026-10-23T03:00:00Z"), timeZone: "UTC" }}
        onClose={onClose}
        projects={mockProjects}
        timeFormat="24h"
        searchTasks={async () => ({
          items: [],
          counts: { all: 0, open: 0, completed: 0 },
          next_cursor: null,
        })}
        searchNotes={async () => ({ items: [] })}
        onOpenTask={() => {}}
        onOpenProject={() => {}}
        onOpenNote={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();

    // Clicking inside dialog does not close
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    // Clicking backdrop closes
    const backdrop = dialog.parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Esc closes
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    // No element with text esc, ↵, ⌘K
    expect(screen.queryByText(/^esc$/i)).toBeNull();
    expect(screen.queryByText(/↵/)).toBeNull();
    expect(screen.queryByText(/⌘K/)).toBeNull();
  });

  it("locks the page behind the popup but keeps typing and scrolling inside it", () => {
    render(
      <SearchPopup
        clock={{ now: () => new Date("2026-10-23T03:00:00Z"), timeZone: "UTC" }}
        onClose={() => {}}
        projects={mockProjects}
        timeFormat="24h"
        searchTasks={vi.fn()}
        searchNotes={vi.fn()}
        onOpenTask={() => {}}
        onOpenProject={() => {}}
        onOpenNote={() => {}}
      />,
    );
    const wheel = () =>
      new WheelEvent("wheel", { bubbles: true, cancelable: true });

    const outside = wheel();
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(true);

    const inside = wheel();
    screen.getByRole("dialog").dispatchEvent(inside);
    expect(inside.defaultPrevented).toBe(false);

    const space = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    screen.getByRole("combobox").dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
  });

  it("navigates rows with ArrowDown and Enter, opens task and project", async () => {
    vi.useFakeTimers();
    try {
      const onOpenTask = vi.fn();
      const onOpenProject = vi.fn();

      const searchTasksMock = vi.fn().mockResolvedValue({
        items: [
          task({ id: "t-1", title: "Task First" }),
          task({ id: "t-2", title: "Task Second" }),
        ],
        counts: { all: 2, open: 2, completed: 0 },
        next_cursor: null,
      });

      render(
        <SearchPanel
          variant="popup"
          projects={mockProjects}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={searchTasksMock}
          searchNotes={async () => ({ items: [] })}
          onOpenTask={onOpenTask}
          onOpenProject={onOpenProject}
          onOpenNote={() => {}}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "Task" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SEARCH_DEBOUNCE_MS + SEARCH_SETTLE_MS,
        );
      });

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      expect(options[0].getAttribute("aria-selected")).toBe("true");

      // ArrowDown to second row
      act(() => {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      });
      const updatedOptions = screen.getAllByRole("option");
      expect(updatedOptions[1].getAttribute("aria-selected")).toBe("true");

      // Enter opens active (second) row
      act(() => {
        fireEvent.keyDown(input, { key: "Enter" });
      });
      expect(onOpenTask).toHaveBeenCalledWith("t-2");

      // Direct clicking task calls onOpenTask
      fireEvent.click(options[0]);
      expect(onOpenTask).toHaveBeenCalledWith("t-1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clicking a note row calls onOpenNote and nothing else happens", async () => {
    vi.useFakeTimers();
    try {
      const onOpenTask = vi.fn();
      const onOpenProject = vi.fn();
      const onOpenNote = vi.fn();

      const searchNotesMock = vi.fn().mockResolvedValue({
        items: [
          {
            id: "n-1",
            title: "Note Title",
            snippet: "Note Snippet Content",
            status: "done",
            written_at: "2026-10-23T08:00:00Z",
          },
        ],
      });

      render(
        <SearchPanel
          variant="popup"
          projects={[]}
          today="2026-10-23"
          timeFormat="24h"
          searchTasks={async () => ({
            items: [],
            counts: { all: 0, open: 0, completed: 0 },
            next_cursor: null,
          })}
          searchNotes={searchNotesMock}
          onOpenTask={onOpenTask}
          onOpenProject={onOpenProject}
          onOpenNote={onOpenNote}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "Note" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SEARCH_DEBOUNCE_MS + SEARCH_SETTLE_MS,
        );
      });

      const noteOption = screen.getByRole("option");
      fireEvent.click(noteOption);

      expect(onOpenNote).toHaveBeenCalledWith("n-1");
      expect(onOpenTask).not.toHaveBeenCalled();
      expect(onOpenProject).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("AppShell: Ctrl+K calls onOpenSearch; / does not fire inside an input", async () => {
    const onOpenSearch = vi.fn();
    render(
      <AppShell tab="inbox" onOpenSearch={onOpenSearch}>
        <input aria-label="test-field" />
      </AppShell>,
    );

    // Ctrl+K opens search
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(onOpenSearch).toHaveBeenCalledTimes(1);

    // ⌘K opens search
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(onOpenSearch).toHaveBeenCalledTimes(2);

    // / outside input opens search
    fireEvent.keyDown(document, { key: "/" });
    expect(onOpenSearch).toHaveBeenCalledTimes(3);

    // / inside input does NOT open search
    const field = screen.getByRole("textbox", { name: "test-field" });
    field.focus();
    fireEvent.keyDown(document, { key: "/" });
    expect(onOpenSearch).toHaveBeenCalledTimes(3);
  });
});
