import { highlightParts } from "../../../domain/search";

type Part = ReturnType<typeof highlightParts>[number];

/** Matched words with only a space between them read as one highlight. */
function mergeMatches(parts: Part[]): Part[] {
  return parts.reduce<Part[]>((merged, part, i, all) => {
    const last = merged[merged.length - 1];
    const bridges =
      !part.match && part.text.trim() === "" && all[i + 1]?.match === true;
    if (last?.match && (part.match || bridges)) last.text += part.text;
    else merged.push({ ...part });
    return merged;
  }, []);
}

/** `text` with the words the search matched marked. */
export function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {mergeMatches(highlightParts(text, query)).map((part, i) => {
        if (!part.match) return part.text;
        return (
          <mark
            key={i}
            className="rounded-[3px] bg-ink/20 px-0.5 font-semibold text-ink"
          >
            {part.text}
          </mark>
        );
      })}
    </>
  );
}
