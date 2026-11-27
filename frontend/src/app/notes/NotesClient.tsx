"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppFrame } from "../AppFrame";
import { appClock } from "../appClock";
import { useToday } from "../../ui/features/tasks/useToday";
import { ApiRequestError, rateLimited } from "../../lib/apiError";
import {
  deviceNotes,
  listNotes,
  reviveNote,
  type NoteListPage,
} from "../../lib/noteApi";
import { useMediaQuery } from "../../ui/components/useMediaQuery";
import { NotesScreen } from "../../ui/features/notes/NotesScreen";
import { TextButton } from "../../ui/components/TextButton";
import { t } from "../../ui/copy";
import type { NoteFilter } from "../../ui/domain/types";
import NoteResultClient from "./[id]/NoteResultClient";
import { NoteResultFrame, useNoteModal } from "./NoteResultFrame";
import { useDataChanged } from "../useDataChanged";

// The next page loads once the end of the list is within one screen
const ONE_SCREEN_AHEAD = "0px 0px 100% 0px";

function NotesContent({ noteId }: { noteId?: string }) {
  const {
    user,
    settings,
    navigate: baseNavigate,
    back,
    openNoteEditor,
  } = useAppFrame();
  const router = useRouter();
  const search = useSearchParams();
  const selected = search.get("note") ?? noteId ?? null;
  const wide = useMediaQuery("(min-width: 1280px)");
  const popup = settings.pageView !== "full";
  const today = useToday(appClock);
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [loaded, setLoaded] = useState<{
    key: string;
    page: NoteListPage | null;
    error: boolean;
    /** A 429: the rate-limited page instead of the message (UX-43). */
    limited?: ApiRequestError | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const requestKey = `${filter}:${revision}`;
  // Keyed like `loaded`: a page still on its way for another filter must not block this list's next page
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const busy = loadingMore === requestKey;
  const data = loaded?.key === requestKey ? loaded.page : null;
  // Another filter (or a refresh) loading: the last list stays, faded, rather than a skeleton
  const shown = data ?? loaded?.page ?? null;
  const stale = !data && shown !== null;
  const error = loaded?.key === requestKey && loaded.error;
  // The summary stays from the last list while another filter loads
  const summary = loaded?.page;
  const limited = (error && loaded.limited) || null;
  const retry = () => setRevision((value) => value + 1);
  const pushed = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let current = true;
    let answered = false;
    // The device's notes first (IM-51); the server's page replaces them when it answers
    void deviceNotes(filter).then((page) => {
      if (current && !answered && page)
        setLoaded({ key: requestKey, page, error: false });
    });
    listNotes(filter)
      .then((page) => {
        answered = true;
        if (current) setLoaded({ key: requestKey, page, error: false });
      })
      .catch(async (error: unknown) => {
        answered = true;
        // Offline: keep showing the device's notes; the banner says why
        const kept =
          error instanceof ApiRequestError ? null : await deviceNotes(filter);
        if (current)
          setLoaded({
            key: requestKey,
            page: kept,
            error: kept === null,
            limited: rateLimited(error),
          });
      });
    return () => {
      current = false;
    };
  }, [filter, requestKey]);
  useDataChanged(() => setRevision((value) => value + 1));
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      router.back();
    } else back();
  }, [router, back]);
  // The note's screen may ask first (Check this first, nothing applied yet) before ×, the backdrop or Escape close it
  const closeGuard = useRef<(() => boolean) | null>(null);
  const requestClose = useCallback(() => {
    if (closeGuard.current?.() !== false) close();
  }, [close]);
  useNoteModal(panelRef, !!selected, wide, popup, requestClose);
  const navigate = useCallback(
    (href: string) => {
      const match = href.match(/^\/notes\/([^/?#]+)/);
      if (wide && match) {
        const target = `/notes?note=${match[1]}`;
        if (selected) router.replace(target, { scroll: false });
        else {
          pushed.current = true;
          router.push(target, { scroll: false });
        }
        return true;
      }
      return baseNavigate(href);
    },
    [wide, selected, router, baseNavigate],
  );
  const more = async () => {
    if (!data?.next_cursor || busy) return;
    setLoadingMore(requestKey);
    try {
      const page = await listNotes(filter, data.next_cursor);
      setLoaded((previous) =>
        previous?.key === requestKey
          ? {
              key: requestKey,
              page: { ...page, items: [...data.items, ...page.items] },
              error: false,
            }
          : previous,
      );
    } catch {
      setLoaded((previous) =>
        previous?.key === requestKey ? { ...previous, error: true } : previous,
      );
    } finally {
      setLoadingMore((key) => (key === requestKey ? null : key));
    }
  };
  const moreRef = useRef(more);
  useEffect(() => {
    moreRef.current = more;
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = !!data?.next_cursor;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void moreRef.current();
      },
      { rootMargin: ONE_SCREEN_AHEAD },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, data?.items.length]);
  return (
    <div>
      <div hidden={!!selected && !wide} inert={!!selected}>
        <NotesScreen
          status={shown && !error ? "ready" : error ? "error" : "loading"}
          stale={stale}
          onRetry={retry}
          limited={limited}
          notes={shown?.items ?? []}
          total={summary?.total}
          needs={summary?.needs_count}
          filter={filter}
          onFilter={setFilter}
          onWriteNote={openNoteEditor}
          onReviveNote={(id) => void reviveNote(id).then(openNoteEditor)}
          selected={selected}
          today={today}
          timeZone={appClock.timeZone}
          timeFormat={settings.timeFormat}
          accountInitial={user?.display_name ?? user?.email ?? ""}
          navigate={navigate}
        />
        {data?.next_cursor && <div ref={sentinelRef} aria-hidden="true" />}
        {data?.next_cursor && (
          <TextButton busy={busy} onClick={more} className="mx-auto block">
            {t("notes.load_more")}
          </TextButton>
        )}
      </div>
      {selected && (
        // Wide: a modal like Task details (popup or side panel, by Page view). Narrower: a page in the column
        <NoteResultFrame
          wide={wide}
          popup={popup}
          panelRef={panelRef}
          onClose={requestClose}
        >
          <NoteResultClient
            key={selected}
            id={selected}
            presentation={wide ? "panel" : "screen"}
            onClose={close}
            closeGuardRef={closeGuard}
          />
        </NoteResultFrame>
      )}
    </div>
  );
}
export default function NotesClient({ noteId }: { noteId?: string }) {
  return (
    <Suspense>
      <NotesContent noteId={noteId} />
    </Suspense>
  );
}
