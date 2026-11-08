import { useEffect } from "react";
// Covers customer profiles, business forms and nested detail dialogs uniformly.
export function ModalAccess() {
  useEffect(() => {
    let top: HTMLElement | null = null;
    const prior = new WeakMap<HTMLElement, HTMLElement>();
    const originalOverflow = document.body.style.overflow;
    const sync = () => {
      const overlays = Array.from(
        document.querySelectorAll<HTMLElement>(".modal-backdrop"),
      ).sort(
        (a, b) =>
          Number(getComputedStyle(a).zIndex) -
          Number(getComputedStyle(b).zIndex),
      );
      const next =
        overlays.at(-1)?.querySelector<HTMLElement>(".modal") || null;
      document.body.style.overflow =
        next || document.querySelector(".sidebar.mobile-open")
          ? "hidden"
          : originalOverflow;
      overlays.forEach((o) => {
        const dialog = o.querySelector<HTMLElement>(".modal");
        if (!dialog) return;
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute(
          "aria-label",
          dialog.querySelector("h2")?.textContent || "Dialog",
        );
        dialog.inert = dialog !== next;
      });
      if (next !== top) {
        if (next && !prior.has(next)) {
          prior.set(next, document.activeElement as HTMLElement);
          next.tabIndex = -1;
          next.focus();
        } else if (top) {
          const old = prior.get(top);
          if (
            old?.isConnected &&
            !old.closest("[inert]") &&
            !old.matches(":disabled") &&
            (!next || next.contains(old))
          )
            old.focus();
          else next?.focus();
        }
        top = next;
      }
    };
    const key = (e: KeyboardEvent) => {
      if (!top) return;
      if (e.key === "Escape") {
        const close =
          Array.from(top.querySelectorAll<HTMLButtonElement>("button")).find(
            (b) => /关闭|Close/.test(b.ariaLabel || b.textContent || ""),
          ) || top.querySelector<HTMLButtonElement>(".modal-head button");
        close?.click();
        e.preventDefault();
        return;
      }
      if (e.key !== "Tab") return;
      const elements = Array.from(
          top.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
          ),
        ).filter((e) => e.offsetParent !== null),
        first = elements[0],
        last = elements.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === top)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === top)
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true });
    document.addEventListener("keydown", key);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", key);
      document.body.style.overflow = originalOverflow;
    };
  }, []);
  return null;
}
