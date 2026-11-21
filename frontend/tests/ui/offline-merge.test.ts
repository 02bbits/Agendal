import { describe, expect, it } from "vitest";
import { offlineTask } from "../../src/lib/offline";

const AT = "2026-11-20T01:00:00.000Z";

describe("#168 (case 18): unticking a done repeat offline", () => {
  it("queues `merged`, so the server decides on sync as it does online", () => {
    expect(offlineTask.lifecycle("t-1", false, AT, true).entries).toEqual([
      {
        kind: "patch",
        entity: "task",
        id: "t-1",
        field: "merged",
        value: true,
        at: AT,
      },
    ]);
  });

  it("a plain reopen still queues `done`", () => {
    expect(offlineTask.lifecycle("t-1", false, AT).entries).toEqual([
      {
        kind: "patch",
        entity: "task",
        id: "t-1",
        field: "done",
        value: false,
        at: AT,
      },
    ]);
  });
});
