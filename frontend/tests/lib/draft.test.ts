import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "../../src/lib/draft";

describe("draft (UX-13)", () => {
  it("keeps the last text and is empty when there is none", async () => {
    expect(await loadDraft()).toBe("");
    await saveDraft("buy milk");
    await saveDraft("buy milk and eggs");
    expect(await loadDraft()).toBe("buy milk and eggs");
    await clearDraft();
    expect(await loadDraft()).toBe("");
  });

  it("saving nothing visible removes the draft", async () => {
    await saveDraft("call mum");
    await saveDraft("  \n ");
    expect(await loadDraft()).toBe("");
  });
});
