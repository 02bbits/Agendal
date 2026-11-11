import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  clearDraft,
  keepDraftOnHide,
  loadDraft,
  saveDraft,
} from "../../src/lib/draft";

describe("draft (UX-13)", () => {
  it("keeps the last text and is empty when there is none", async () => {
    expect(await loadDraft()).toBe("");
    await saveDraft("buy milk");
    await saveDraft("buy milk and eggs");
    expect(await loadDraft()).toBe("buy milk and eggs");
    await clearDraft();
    expect(await loadDraft()).toBe("");
  });

  it("text kept as the page went comes back, and moves into IndexedDB (NC-E1)", async () => {
    await saveDraft("call mum");
    keepDraftOnHide("call mum and dad");
    expect(await loadDraft()).toBe("call mum and dad");
    expect(localStorage.getItem("agendal.draft.hidden")).toBeNull();
    expect(await loadDraft()).toBe("call mum and dad");
  });

  it("a save of older text leaves the newer copy; Discard drops it", async () => {
    keepDraftOnHide("buy milk and eggs");
    await saveDraft("buy milk");
    expect(await loadDraft()).toBe("buy milk and eggs");
    keepDraftOnHide("buy bread");
    await clearDraft();
    expect(await loadDraft()).toBe("");
  });

  it("saving nothing visible removes the draft", async () => {
    await saveDraft("call mum");
    await saveDraft("  \n ");
    expect(await loadDraft()).toBe("");
  });
});
