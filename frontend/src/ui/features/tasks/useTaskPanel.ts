import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Navigate } from "../shell/routes";
import { useMediaQuery } from "./useMediaQuery";

export interface TaskPanelState {
  selectedTaskId: string | null;
  isWide: boolean;
  navigate: Navigate;
  closePanel: () => void;
}

// Opening, switching or closing the panel only changes ?task=; the list must
// stay where the user scrolled (Next scrolls to the top by default)
const KEEP_SCROLL = { scroll: false } as const;

export function useTaskPanel(baseNavigate?: Navigate): TaskPanelState {
  const isWide = useMediaQuery("(min-width: 1280px)");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedTaskId = searchParams.get("task");
  const pushedTaskRef = useRef(false);

  useEffect(() => {
    if (!selectedTaskId) {
      pushedTaskRef.current = false;
    }
  }, [selectedTaskId]);

  const closePanel = useCallback(() => {
    if (pushedTaskRef.current) {
      pushedTaskRef.current = false;
      router.back();
    } else {
      router.replace(pathname, KEEP_SCROLL);
    }
  }, [pathname, router]);

  const navigate: Navigate = useCallback(
    (href: string) => {
      const taskMatch = href.match(/^\/tasks\/([^/?#]+)/);
      if (taskMatch && isWide) {
        const taskId = decodeURIComponent(taskMatch[1]!);
        if (selectedTaskId) {
          router.replace(
            `${pathname}?task=${encodeURIComponent(taskId)}`,
            KEEP_SCROLL,
          );
        } else {
          pushedTaskRef.current = true;
          router.push(
            `${pathname}?task=${encodeURIComponent(taskId)}`,
            KEEP_SCROLL,
          );
        }
        return true;
      }
      return baseNavigate ? baseNavigate(href) : false;
    },
    [baseNavigate, isWide, pathname, router, selectedTaskId],
  );

  return { selectedTaskId, isWide, navigate, closePanel };
}
