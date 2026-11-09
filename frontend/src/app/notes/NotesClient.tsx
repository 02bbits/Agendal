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
import { TextButton } from "../../ui/components/TextButton";
import { cx } from "../../ui/components/cx";
import { PanelHeader } from "../../ui/features/tasks/details/PanelHeader";
import { t } from "../../ui/copy";
import type { NoteFilter } from "../../ui/domain/types";
import NoteResultClient from "./[id]/NoteResultClient";

function NotesContent({ noteId }: { noteId?: string }) {
  const { user, settings, navigate: baseNavigate, back } = useAppFrame();
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
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestKey = `${filter}:${revision}`;
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
  useModalFocus(panelRef, panelRef, !!selected && wide, requestClose);
  useEffect(() => {
    if (!selected || !wide) return;
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
  }, [selected, wide]);
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
    setBusy(true);
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
      setBusy(false);
    }
  };
  return (
    <div>
      <div hidden={!!selected && !wide} inert={!!selected}>
        {data ? (
          <NotesScreen
            notes={data.items}
            total={data.total}
            needs={data.needs_count}
            filter={filter}
            onFilter={setFilter}
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
        {data?.next_cursor && (
          <TextButton busy={busy} onClick={more} className="mx-auto block">
            {t("notes.load_more")}
          </TextButton>
        )}
      </div>
      {selected && (
        <>
          {/* Wide: a modal like Task details (popup or side panel, by Page view). Narrower: a page in the
              column, like the task screen. One tree for both, so a resize doesn't remount the note */}
          {wide && (
            <div
              aria-hidden="true"
              className={cx(
                "fixed inset-0 z-[54] backdrop-blur-[2px] motion-safe:animate-fade-in",
                popup ? "bg-scrim/60" : "bg-scrim",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={requestClose}
            />
          )}
          <div
            className={
              wide && popup
                ? "pointer-events-none fixed inset-0 z-[55] flex items-center justify-center p-4 sm:p-6 md:p-8"
                : "contents"
            }
          >
            <aside
              ref={panelRef}
              role={wide ? "dialog" : undefined}
              aria-modal={wide || undefined}
              tabIndex={-1}
              data-modal-host={wide || undefined}
              aria-label={t("nav.notes")}
              className={cx(
                "flex flex-col outline-none",
                wide &&
                  (popup
                    ? "pointer-events-auto max-h-[85vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-separator/60 bg-surface shadow-2xl motion-safe:animate-scale-in"
                    : "fixed inset-y-0 right-0 z-[55] w-full max-w-[400px] border-l border-separator bg-surface pr-[env(safe-area-inset-right,0px)] shadow-2xl motion-safe:animate-panel-in"),
              )}
            >
              {wide && <NoteScrollLock panelRef={panelRef} />}
              {wide && (
                <PanelHeader title={t("nav.notes")} onClose={requestClose} />
              )}
              <div
                className={
                  wide
                    ? "relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4"
                    : undefined
                }
              >
                <NoteResultClient
                  key={selected}
                  id={selected}
                  presentation={wide ? "panel" : "screen"}
                  onClose={close}
                  closeGuardRef={closeGuard}
                />
              </div>
            </aside>
          </div>
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
