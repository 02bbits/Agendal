import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { countText, t, tc } from "../../src/ui/copy";
import { Section } from "../../src/ui/features/lists/Section";
import { Sidebar } from "../../src/ui/features/shell/Sidebar";

describe("#168: 0 shows nothing in navigation and None on a page", () => {
  it("a page count reads None for 0 and the number otherwise", () => {
    expect(countText(0)).toBe("None");
    expect(countText(3)).toBe("3");
    expect(
      t("list.inbox_subtitle", { overdue: countText(0), today: countText(2) }),
    ).toBe("None overdue · 2 today");
    expect(tc("project.open_count", 0, { count: countText(0) })).toBe(
      "None open tasks",
    );
  });

  it("the sidebar shows no count for a tab with 0", () => {
    render(
      <Sidebar
        active="inbox"
        accountName="Alex"
        counts={{ inbox: 0, upcoming: 4, projects: 0, notes: 0 }}
      />,
    );
    const inbox = screen.getByRole("link", { name: /Inbox/ });
    const upcoming = screen.getByRole("link", { name: /Upcoming/ });
    expect(inbox.textContent).not.toMatch(/\d/);
    expect(upcoming.textContent).toContain("4");
  });

  it("a list section with 0 reads None", () => {
    render(
      <Section title="Overdue" count={0}>
        <li>row</li>
      </Section>,
    );
    expect(screen.getByText("None")).toBeTruthy();
  });
});
