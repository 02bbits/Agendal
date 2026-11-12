import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KEEP_NOTES,
  putNoteEntries,
  putNoteResult,
  putProject,
  putTasks,
  readMe,
  readNoteEntries,
  readNoteResult,
  readProjects,
  readTasks,
  removeTasks,
  replaceProjects,
  saveMe,
} from "../../src/lib/localStore";
import { task } from "../ui/fixtures";
import type { NoteListEntry, NoteResult, Project } from "../../src/ui";

// Note `n<i>` was written `i` minutes after 08:00 UTC
const entry = (i: number): NoteListEntry => ({
  id: `n${i}`,
  status: "done",
  name: null,
  excerpt: `n${i}`,
  written_at: new Date(Date.UTC(2026, 9, 23, 8, i)).toISOString(),
  source_file_name: null,
  counts: { created: 1, updated: 0, deleted: 0 },
});

const project = (id: string, name: string) =>
  ({ id, name, colour: "blue" }) as Project;

afterEach(async () => {
  vi.unstubAllGlobals();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase("agendal");
    request.onsuccess = request.onerror = resolve;
  });
});

describe("device store (IM-51)", () => {
  it("upserts tasks by id and removes deleted ones", async () => {
    await putTasks([task({ id: "a", title: "One" }), undefined]);
    await putTasks([
      task({ id: "a", title: "One, renamed" }),
      task({ id: "b", title: "Two" }),
    ]);
    await removeTasks(["b"]);
    expect((await readTasks()).map((x) => [x.id, x.title])).toEqual([
      ["a", "One, renamed"],
    ]);
  });

  it("a full project list replaces the stored one", async () => {
    await putProject(project("p1", "Old"));
    await replaceProjects([project("p2", "New")]);
    expect((await readProjects()).map((p) => p.id)).toEqual(["p2"]);
  });

  it("keeps the account settings", async () => {
    await saveMe({ id: 1, theme: "dark" });
    expect(await readMe()).toEqual({ id: 1, theme: "dark" });
  });

  it("storage blocked: reads come back empty and writes don't throw", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    await expect(
      putTasks([task({ id: "a", title: "One" })]),
    ).resolves.toBeUndefined();
    expect(await readTasks()).toEqual([]);
    expect(await readMe()).toBeUndefined();
  });

  it("keeps only the newest 100 notes", async () => {
    await putNoteEntries(
      Array.from({ length: KEEP_NOTES + 2 }, (_, i) => entry(i)),
    );
    const kept = await readNoteEntries();
    expect(kept).toHaveLength(KEEP_NOTES);
    expect(kept.map((n) => n.id)).not.toContain("n0");
    expect(kept[0]!.id).toBe(`n${KEEP_NOTES + 1}`);
  });

  it("a Notes row doesn't drop the note's kept result", async () => {
    const result = {
      note: {
        id: "n1",
        status: "done",
        name: null,
        text: "call mum",
        written_at: "2026-10-23T08:00:00+07:00",
        source_file_name: null,
      },
      changes: [],
      skipped: [],
    } as unknown as NoteResult;
    await putNoteResult(result);
    await putNoteEntries([{ ...entry(1), name: "Renamed" }]);
    expect((await readNoteResult("n1"))?.note.text).toBe("call mum");
    expect((await readNoteEntries())[0]!.name).toBe("Renamed");
  });
});
