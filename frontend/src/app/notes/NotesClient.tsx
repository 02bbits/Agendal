"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppFrame } from "../AppFrame";
import { appClock } from "../appClock";
import { useToday } from "../../ui/features/tasks/useToday";
import { listNotes, NOTE_UPDATED, type NoteListPage } from "../../lib/noteApi";
import { useMediaQuery } from "../../ui/components/useMediaQuery";
import { useModalFocus } from "../../ui/components/useModalFocus";
import { useBackgroundScrollLock } from "../../ui/components/useBackgroundScrollLock";
import { NotesScreen } from "../../ui/features/notes/NotesScreen";
import { Button } from "../../ui/components/Button";
import { IconButton } from "../../ui/components/IconButton";
import { XIcon } from "../../ui/components/icons";
import { t } from "../../ui/copy";
import type { NoteFilter } from "../../ui/domain/types";
import NoteResultClient from "./[id]/NoteResultClient";

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
  const today = useToday(appClock);
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [loaded, setLoaded] = useState<{
    key: string;
    page: NoteListPage | null;
    error: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const requestKey = `${filter}:${revision}`;
  // Keyed like `loaded`: a page still on its way for another filter must not block this list's next page
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const busy = loadingMore === requestKey;
  const data = loaded?.key === requestKey ? loaded.page : null;
  const error = loaded?.key === requestKey && loaded.error;
  const pushed = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let current = true;
    listNotes(filter)
      .then((page) => {
        if (current) setLoaded({ key: requestKey, page, error: false });
      })
      .catch(() => {
        if (current) setLoaded({ key: requestKey, page: null, error: true });
      });
    return () => {
      current = false;
    };
  }, [filter, requestKey]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(NOTE_UPDATED, refresh);
    window.addEventListener("agendal:task-created", refresh);
    window.addEventListener("agendal:note-renamed", refresh);
    return () => {
      window.removeEventListener(NOTE_UPDATED, refresh);
      window.removeEventListener("agendal:task-created", refresh);
      window.removeEventListener("agendal:note-renamed", refresh);
    };
  }, []);
  useEffect(() => {
    if (!selected) return;
    document.documentElement.dataset.noteSelected = "open";
    if (wide) document.documentElement.dataset.notePanel = "open";
    return () => {
      delete document.documentElement.dataset.notePanel;
      delete document.documentElement.dataset.noteSelected;
    };
  }, [wide, selected]);
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
  useModalFocus(panelRef, panelRef, !!selected, requestClose);
  useEffect(() => {
    if (!selected) return;
    const background = [
      ...document.querySelectorAll<HTMLElement>("[data-shell-navigation]"),
    ];
    const previous = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    return () => {
      background.forEach((element, index) => {
        element.inert = previous[index]!;
      });
    };
  }, [selected]);
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
    <div className={wide && selected ? "pr-[400px]" : ""}>
      <div hidden={!!selected && !wide} inert={!!selected}>
        {data ? (
          <NotesScreen
            notes={data.items}
            total={data.total}
            needs={data.needs_count}
            filter={filter}
            onFilter={setFilter}
            onWriteNote={openNoteEditor}
            selected={selected}
            today={today}
            timeZone={appClock.timeZone}
            timeFormat={settings.timeFormat}
            accountInitial={user?.display_name ?? user?.email ?? ""}
            navigate={navigate}
          />
        ) : error ? (
          <p role="status" className="py-8 text-body">
            {t("error.generic", { request_id: "" })}
          </p>
        ) : (
          // Loading: the header, filter chips and a few rows in place, like the note screen's skeleton
          <div
            role="status"
            aria-busy="true"
            aria-label={t("nav.notes")}
            className="flex animate-pulse flex-col gap-4 pt-3 md:pt-8"
          >
            <div className="h-3 w-40 rounded bg-surface" />
            <div className="h-10 w-32 rounded bg-surface" />
            <div className="flex gap-2">
              <div className="h-7 w-12 rounded-full bg-surface" />
              <div className="h-7 w-20 rounded-full bg-surface" />
              <div className="h-7 w-16 rounded-full bg-surface" />
            </div>
            <div className="h-80 w-full rounded-box bg-surface" />
          </div>
        )}
        {error && (
          <Button onClick={() => setRevision((value) => value + 1)}>
            {t("common.retry")}
          </Button>
        )}
        {data?.next_cursor && <div ref={sentinelRef} aria-hidden="true" />}
        {data?.next_cursor && (
          <Button busy={busy} onClick={more}>
            {t("notes.load_more")}
          </Button>
        )}
      </div>
      {selected && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[54] bg-scrim backdrop-blur-[2px] transition-opacity duration-200"
            onMouseDown={(event) => event.preventDefault()}
            onClick={requestClose}
          />
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            data-modal-host
            aria-label={t("nav.notes")}
            className="fixed inset-0 z-[55] flex flex-col bg-paper outline-none shadow-2xl md:left-[248px] xl:left-auto xl:w-[400px] xl:border-l xl:border-separator"
          >
            <NoteScrollLock panelRef={panelRef} />
            {wide && (
              <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-separator bg-surface px-4">
                <span className="font-semibold">{t("nav.notes")}</span>
                <IconButton
                  plain
                  label={t("common.close")}
                  icon={<XIcon />}
                  onClick={requestClose}
                />
              </header>
            )}
            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 xl:pt-4">
              <NoteResultClient
                key={selected}
                id={selected}
                presentation={wide ? "panel" : "screen"}
                onClose={close}
                closeGuardRef={closeGuard}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
function NoteScrollLock({
  panelRef,
}: {
  panelRef: React.RefObject<HTMLElement | null>;
}) {
  useBackgroundScrollLock(panelRef);
  return null;
}
export default function NotesClient({ noteId }: { noteId?: string }) {
  return (
    <Suspense>
      <NotesContent noteId={noteId} />
    </Suspense>
  );
}
