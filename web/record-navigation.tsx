import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** The caller supplies a snapshot of the list that opened this detail. */
export function RecordNavigation({
  ids,
  current,
  onSelect,
  en = false,
}: {
  ids: string[];
  current: string;
  onSelect: (id: string) => void;
  en?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const index = ids.indexOf(current);
  const move = (offset: number) => {
    const id = ids[index + offset];
    if (index >= 0 && id) onSelect(id);
  };
  useEffect(() => {
    const modal = root.current?.closest<HTMLElement>(".modal");
    const body = modal?.querySelector(".modal-body");
    if (body) body.scrollTop = 0;
    if (
      root.current?.contains(document.activeElement) &&
      document.activeElement?.matches(":disabled")
    )
      root.current.focus();
  }, [current]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const modal = root.current?.closest<HTMLElement>(".modal");
      if (
        !modal ||
        modal.closest("[inert]") ||
        !modal.contains(document.activeElement)
      )
        return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']"))
        return;
      if (
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat
      )
        return;
      if (event.key !== "PageUp" && event.key !== "PageDown") return;
      event.preventDefault();
      move(event.key === "PageUp" ? -1 : 1);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [ids, current, onSelect]);
  if (index < 0 || ids.length < 2) return null;
  return (
    <nav
      ref={root}
      tabIndex={-1}
      className="record-navigation"
      aria-label={en ? "Browse current list" : "浏览当前列表"}
    >
      <div className="record-position">
        <strong role="status">
          {index + 1} <span>/ {ids.length}</span>
        </strong>
        <small>
          {en ? "From the list you opened" : "保留打开时的列表顺序"}
        </small>
      </div>
      <div className="record-controls">
        <button
          className="btn"
          disabled={index === 0}
          aria-keyshortcuts="Alt+PageUp"
          title="Alt + PageUp"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={16} />
          {en ? "Previous" : "上一条"}
        </button>
        <button
          className="btn"
          disabled={index === ids.length - 1}
          aria-keyshortcuts="Alt+PageDown"
          title="Alt + PageDown"
          onClick={() => move(1)}
        >
          {en ? "Next" : "下一条"}
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
