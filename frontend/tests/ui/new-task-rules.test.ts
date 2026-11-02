import { describe, expect, it } from "vitest";
import {
  createBody,
  defaultPriority,
  defaultsFor,
  dueDateFor,
} from "@/ui/domain/newTask";

describe("New task rules (Refs #25)", () => {
  describe("T-NC-51: due date calculation", () => {
    const today = "2026-10-23"; // Friday

    it("Today sets today's date", () => {
      expect(dueDateFor("today", today)).toBe("2026-10-23");
    });

    it("Tomorrow sets tomorrow's date", () => {
      expect(dueDateFor("tomorrow", today)).toBe("2026-10-24");
    });

    it("Next week sets Monday of next week", () => {
      expect(dueDateFor("next_week", today)).toBe("2026-10-26");
    });

    it("on a Monday, next week is the Monday after", () => {
      const monday = "2026-10-26";
      expect(dueDateFor("next_week", monday)).toBe("2026-11-02");
    });

    it("No date sets null", () => {
      expect(dueDateFor("none", today)).toBeNull();
    });

    it("Pick date sets the picked value", () => {
      expect(dueDateFor("pick", today, "2026-11-15")).toBe("2026-11-15");
      expect(dueDateFor("pick", today)).toBeNull();
    });
  });

  describe("T-NC-52: defaults by entry point", () => {
    it("Inbox (/) defaults to Today and no project", () => {
      expect(defaultsFor("/")).toEqual({ chip: "today" });
    });

    it("Upcoming (/upcoming) defaults to Tomorrow and no project", () => {
      expect(defaultsFor("/upcoming")).toEqual({ chip: "tomorrow" });
    });

    it("A project (/projects/{id}) defaults to No date and that project", () => {
      expect(defaultsFor("/projects/proj-123")).toEqual({
        chip: "none",
        projectId: "proj-123",
      });
      expect(defaultsFor("/projects/uuid-abc-def")).toEqual({
        chip: "none",
        projectId: "uuid-abc-def",
      });
    });

    it("No project (/projects/none) defaults to No date and no project", () => {
      expect(defaultsFor("/projects/none")).toEqual({
        chip: "none",
      });
    });

    it("Anywhere else defaults to No date and no project", () => {
      expect(defaultsFor("/notes")).toEqual({ chip: "none" });
      expect(defaultsFor("/search")).toEqual({ chip: "none" });
      expect(defaultsFor("/account")).toEqual({ chip: "none" });
      expect(defaultsFor("/projects")).toEqual({ chip: "none" });
    });
  });

  describe("defaultPriority rule", () => {
    const today = "2026-10-23";

    it("defaults to medium when dueDate === today", () => {
      expect(defaultPriority("2026-10-23", today)).toBe("medium");
    });

    it("defaults to low when dueDate !== today", () => {
      expect(defaultPriority("2026-10-24", today)).toBe("low");
      expect(defaultPriority("2026-10-26", today)).toBe("low");
      expect(defaultPriority(null, today)).toBe("low");
    });
  });

  describe("createBody", () => {
    it("trims title and includes specified fields", () => {
      const body = createBody({
        id: "0192e21b-6800-7000-8000-000000000001",
        title: "  Buy milk  ",
        dueDate: "2026-10-23",
        priority: "medium",
        projectId: "p-1",
      });

      expect(body).toEqual({
        id: "0192e21b-6800-7000-8000-000000000001",
        title: "Buy milk",
        due_date: "2026-10-23",
        priority: "medium",
        project_id: "p-1",
      });
    });

    it("omits null and undefined fields that the API doesn't need", () => {
      const body = createBody({
        id: "0192e21b-6800-7000-8000-000000000001",
        title: "Buy milk",
        dueDate: null,
        projectId: null,
      });

      expect(body).toEqual({
        id: "0192e21b-6800-7000-8000-000000000001",
        title: "Buy milk",
      });
      expect(body).not.toHaveProperty("due_date");
      expect(body).not.toHaveProperty("project_id");
      expect(body).not.toHaveProperty("priority");
    });
  });
});
