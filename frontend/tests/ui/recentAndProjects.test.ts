import { beforeEach, describe, expect, it } from "vitest";
import {
  addRecent,
  clearRecent,
  readRecent,
  removeRecent,
} from "../../src/ui/domain/recentSearches";
import { searchProjects } from "../../src/ui/domain/search";

describe("searchProjects", () => {
  const projects = [
    { id: "1", name: "Đồ án tốt nghiệp" },
    { id: "2", name: "Công việc hàng ngày" },
    { id: "3", name: "Đồ án Website Agendal" },
    { id: "4", name: "Café gặp mặt bạn bè" },
  ];

  it("returns empty array for empty or whitespace query", () => {
    expect(searchProjects(projects, "")).toEqual([]);
    expect(searchProjects(projects, "   ")).toEqual([]);
  });

  it("matches every word accent-insensitively and preserves order", () => {
    const res1 = searchProjects(projects, "do an");
    expect(res1.map((p) => p.name)).toEqual([
      "Đồ án tốt nghiệp",
      "Đồ án Website Agendal",
    ]);

    const res2 = searchProjects(projects, "website do an");
    expect(res2.map((p) => p.name)).toEqual(["Đồ án Website Agendal"]);

    const res3 = searchProjects(projects, "cafe");
    expect(res3.map((p) => p.name)).toEqual(["Café gặp mặt bạn bè"]);
  });
});

describe("recentSearches", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads empty list when storage is empty or contains bad JSON", () => {
    expect(readRecent()).toEqual([]);

    window.localStorage.setItem("agendal.search.recent", "not-a-json{[[");
    expect(readRecent()).toEqual([]);

    window.localStorage.setItem("agendal.search.recent", "123");
    expect(readRecent()).toEqual([]);

    window.localStorage.setItem(
      "agendal.search.recent",
      JSON.stringify({ not: "an array" }),
    );
    expect(readRecent()).toEqual([]);
  });

  it("adds items up to 5, newest first, deduplicated by normalize", () => {
    addRecent("query 1");
    addRecent("query 2");
    addRecent("query 3");
    addRecent("query 4");
    addRecent("query 5");
    expect(readRecent()).toEqual([
      "query 5",
      "query 4",
      "query 3",
      "query 2",
      "query 1",
    ]);

    // Adding 6th item drops the oldest
    addRecent("query 6");
    expect(readRecent()).toEqual([
      "query 6",
      "query 5",
      "query 4",
      "query 3",
      "query 2",
    ]);

    // Deduplication with normalize (e.g. accents / case)
    addRecent("QUERY 4");
    expect(readRecent()).toEqual([
      "QUERY 4",
      "query 6",
      "query 5",
      "query 3",
      "query 2",
    ]);

    addRecent("café");
    addRecent("cafe");
    expect(readRecent()).toEqual([
      "cafe",
      "QUERY 4",
      "query 6",
      "query 5",
      "query 3",
    ]);
  });

  it("removes recent searches", () => {
    addRecent("alpha");
    addRecent("beta");
    removeRecent("ALPHA");
    expect(readRecent()).toEqual(["beta"]);
  });

  it("clears all recent searches", () => {
    addRecent("alpha");
    addRecent("beta");
    clearRecent();
    expect(readRecent()).toEqual([]);
  });
});
