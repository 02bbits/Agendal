import { useEffect, useRef, useState } from "react";
import { MoreIcon, PencilIcon, TrashIcon } from "../../components/icons";
import { t } from "../../copy";

export interface ProjectCardMenuProps {
  onRename?: () => void;
  onDelete?: () => void;
}

export function ProjectCardMenu({ onRename, onDelete }: ProjectCardMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (!onRename && !onDelete) {
    return <div className="size-7" />;
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-ink-tertiary transition-colors hover:bg-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={t("project.menu")}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
      >
        <MoreIcon size={16} />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-8 z-30 min-w-36 rounded-xl border border-separator bg-surface p-1 shadow-lg"
        >
          {onRename && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-footnote font-medium text-ink hover:bg-fill transition-colors border-0 bg-transparent"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
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
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-footnote font-medium text-error hover:bg-error/10 transition-colors border-0 bg-transparent"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
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
