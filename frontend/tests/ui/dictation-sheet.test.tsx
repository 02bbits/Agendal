import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { record, transcribe } from "../../src/lib/dictation";
import { t } from "../../src/ui/copy";
import { DictationSheet } from "../../src/ui/features/notes/DictationSheet";

vi.mock("../../src/lib/dictation", () => ({
  micNoticeSeen: () => true,
  markMicNoticeSeen: vi.fn(),
  record: vi.fn(),
  transcribe: vi.fn(),
}));

/** The recording ends at once; the words arrive when the test answers. */
function writingDown() {
  let answer: (words: string) => void = () => {};
  vi.mocked(record).mockReturnValue({
    stop: vi.fn(),
    cancel: vi.fn(),
    done: Promise.resolve(new Blob(["wav"])),
  });
  vi.mocked(transcribe).mockImplementation(
    () => new Promise((resolve) => (answer = resolve)),
  );
  return (words: string) => answer(words);
}

const signal = () => vi.mocked(transcribe).mock.calls[0][1] as AbortSignal;

describe("DictationSheet (NC §2.3)", () => {
  beforeEach(() => {
    vi.mocked(transcribe).mockReset();
  });

  it("puts the words heard into the note", async () => {
    const answer = writingDown();
    const onWords = vi.fn();
    render(<DictationSheet onClose={vi.fn()} onWords={onWords} />);
    await waitFor(() => expect(transcribe).toHaveBeenCalled());

    answer("call mum");

    await waitFor(() => expect(onWords).toHaveBeenCalledWith("call mum"));
  });

  it("drops the upload and its words when closed while they're written down", async () => {
    const answer = writingDown();
    const onWords = vi.fn();
    const onClose = vi.fn();
    render(<DictationSheet onClose={onClose} onWords={onWords} />);
    await waitFor(() => expect(transcribe).toHaveBeenCalled());

    await userEvent.click(
      screen.getAllByRole("button", { name: t("common.cancel") })[0],
    );
    answer("call mum");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onClose).toHaveBeenCalled();
    expect(signal().aborted).toBe(true);
    expect(onWords).not.toHaveBeenCalled();
  });
});
