import { describe, expect, it } from "vitest";
import { reopenSeriesChanges } from "../../src/ui/domain/series";
import { task } from "./fixtures";

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

// Nov → Dec → Jan → Feb (open, made by completing Jan)
const series = (open: string[] = []) =>
  ["nov", "dec", "jan", "feb"].map((id, i, all) =>
    task({
      id,
      title: "Retro",
      repeat: "monthly",
      done: id !== "feb" && !open.includes(id),
      previous_occurrence_id: i === 0 ? null : all[i - 1],
    }),
  );

describe("#168: reopening keeps one open occurrence per series", () => {
  it("reopening an older one withdraws the open one at the end", () => {
    expect(reopenSeriesChanges(series(), [], "dec")).toEqual({
      withdraw: [expect.objectContaining({ id: "feb" })],
      close: [],
    });
  });

  it("#10: a later occurrence undone before is withdrawn too, never done again (the series rewinds)", () => {
    // Jan was undone (Feb withdrawn): reopening Dec withdraws Jan
    const rows = series(["jan"]).filter((row) => row.id !== "feb");
    const feb = series().find((row) => row.id === "feb")!;
    const changes = reopenSeriesChanges(rows, [feb], "dec");
    expect(ids(changes.withdraw)).toEqual(["jan"]);
    expect(changes.close).toEqual([]);
  });

  it("an earlier occurrence still open goes back to done", () => {
    const rows = series(["dec"]).filter((row) => row.id !== "feb");
    expect(ids(reopenSeriesChanges(rows, [], "jan").close)).toEqual(["dec"]);
  });

  it("a task with no series changes nothing", () => {
    expect(
      reopenSeriesChanges(
        [task({ id: "one", title: "One", done: true })],
        [],
        "one",
      ),
    ).toEqual({
      withdraw: [],
      close: [],
    });
  });
});
