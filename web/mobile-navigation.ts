import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

/** The narrow-screen navigation is an overlay; desktop navigation is persistent. */
export function useMobileNavigation(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
  enabled: boolean,
) {
  const navigationRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 760px)");
    const sync = () => {
      if (!narrow.matches || !enabled) setOpen(false);
    };
    sync();
    narrow.addEventListener("change", sync);
    return () => narrow.removeEventListener("change", sync);
  }, [enabled, setOpen]);

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!open || !enabled || !navigation) return;
    const visible = (element: HTMLElement) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden";
    const controls = () =>
      Array.from(
        navigation.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),[tabindex="0"]',
        ),
      ).filter(visible);
    const current = () =>
      navigation.querySelector<HTMLElement>('[aria-current="page"]') ||
      controls()[0];
    const background = Array.from(navigation.parentElement!.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          element !== navigation &&
          !element.classList.contains("navigation-shade"),
      )
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => (element.inert = true));
    current()?.focus();

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const focus = (event: FocusEvent) => {
      if (!navigation.contains(event.target as Node)) current()?.focus();
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
      background.forEach(({ element, inert }) => (element.inert = inert));
      const trigger = triggerRef.current;
      if (trigger?.isConnected && visible(trigger)) trigger.focus();
      else if (navigation.isConnected && visible(navigation))
        current()?.focus();
    };
  }, [open, enabled, setOpen]);

  return { navigationRef, triggerRef };
}
