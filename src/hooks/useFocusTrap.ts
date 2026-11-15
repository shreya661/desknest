import { useEffect, useRef, RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Reusable focus trap hook for accessible modal dialogs (UI-03).
 * Traps Tab and Shift+Tab navigation within the container, handles Escape key,
 * and restores focus to the previously active element upon closing.
 */
export function useFocusTrap(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose?: () => void
): void {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (previousActiveElement.current && document.contains(previousActiveElement.current)) {
        previousActiveElement.current.focus();
      }
      previousActiveElement.current = null;
      return;
    }

    // Capture the element focused before the modal was opened
    previousActiveElement.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    // Helper to determine if an element is focusable and visible
    const isVisible = (el: HTMLElement) => {
      if (el.style.display === "none" || el.style.visibility === "hidden") return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      return true;
    };

    // Focus first focusable element inside modal or container itself
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(isVisible);

    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      if (!container.getAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const currentFocusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isVisible);

      if (currentFocusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const firstElement = currentFocusables[0];
      const lastElement = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: if on first element, wrap around to last element
        if (document.activeElement === firstElement || document.activeElement === container) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap around to first element
        if (document.activeElement === lastElement || document.activeElement === container) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, containerRef, onClose]);
}
