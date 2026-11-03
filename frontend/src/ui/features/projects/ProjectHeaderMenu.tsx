import { useEffect, useRef, useState } from "react";
import { MoreIcon, PencilIcon, TrashIcon } from "../../components/icons";
import { t } from "../../copy";

export interface ProjectHeaderMenuProps {
  onRename?: () => void;
  onDelete?: () => void;
}

export function ProjectHeaderMenu({
  onRename,
  onDelete,
}: ProjectHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!onRename && !onDelete) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-ink-tertiary transition-colors hover:bg-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={t("project.menu")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-30 min-w-36 rounded-xl border border-separator bg-surface p-1 shadow-lg"
        >
          {onRename && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-footnote font-medium text-ink hover:bg-fill transition-colors border-0 bg-transparent"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
            >
              <PencilIcon size={15} />
              <span>{t("project.rename")}</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-footnote font-medium text-danger hover:bg-fill transition-colors border-0 bg-transparent"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <TrashIcon size={15} />
              <span>{t("project.delete")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
