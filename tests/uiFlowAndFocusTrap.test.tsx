import React, { useRef, useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { calculateSynchronizedScrollTop } from "../src/utils/scrollSync";
import { useFocusTrap } from "../src/hooks/useFocusTrap";

describe("UI & Accessibility Architecture (UI-01, UI-02, UI-03)", () => {
  describe("Proportional Split-View Scroll Synchronization (UI-01)", () => {
    it("maps 0% scroll at top of source to 0 in target pane", () => {
      const targetScroll = calculateSynchronizedScrollTop(
        0,     // source scrollTop
        2000,  // source scrollHeight
        500,   // source clientHeight (maxSource = 1500)
        1200,  // target scrollHeight
        400    // target clientHeight (maxTarget = 800)
      );
      expect(targetScroll).toBe(0);
    });

    it("maps 100% scroll at bottom of source to maximum target scroll position", () => {
      const targetScroll = calculateSynchronizedScrollTop(
        1500,  // source scrollTop = maxSource
        2000,
        500,
        1200,
        400    // maxTarget = 800
      );
      expect(targetScroll).toBe(800);
    });

    it("accurately computes 50% midpoint scroll between asymmetric panes", () => {
      const targetScroll = calculateSynchronizedScrollTop(
        750,   // 750 / 1500 = 0.5
        2000,
        500,
        1000,
        400    // maxTarget = 600 -> 0.5 * 600 = 300
      );
      expect(targetScroll).toBe(300);
    });

    it("safely handles panes without overflow (zero maxTarget) without NaN or crash", () => {
      const targetScroll = calculateSynchronizedScrollTop(
        100,
        500,
        500,   // source has no overflow (maxSource = 1 fallback)
        300,
        300    // target has no overflow (maxTarget = 0)
      );
      expect(targetScroll).toBe(0);
      expect(Number.isNaN(targetScroll)).toBe(false);
    });

    it("clamps negative overscroll and extreme bottom overscroll within bounds", () => {
      const overscrollNegative = calculateSynchronizedScrollTop(-50, 1000, 500, 800, 400);
      expect(overscrollNegative).toBe(0);

      const overscrollPositive = calculateSynchronizedScrollTop(2000, 1000, 500, 800, 400);
      expect(overscrollPositive).toBe(400); // capped at maxTarget (800 - 400)
    });
  });

  describe("Modal Focus Trap & Keyboard Navigation (UI-03)", () => {
    // Test harness component for useFocusTrap
    const TestModalComponent: React.FC<{
      isOpen: boolean;
      onClose?: () => void;
    }> = ({ isOpen, onClose }) => {
      const containerRef = useRef<HTMLDivElement>(null);
      useFocusTrap(isOpen, containerRef, onClose);

      if (!isOpen) return null;

      return (
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          data-testid="modal-container"
        >
          <button data-testid="btn-first">First Action</button>
          <input data-testid="input-middle" type="text" placeholder="Middle input" />
          <button data-testid="btn-last">Last Close Action</button>
        </div>
      );
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("focuses the first focusable element when the modal is opened", async () => {
      const { rerender } = render(<TestModalComponent isOpen={false} />);
      expect(screen.queryByTestId("modal-container")).toBeNull();

      rerender(<TestModalComponent isOpen={true} />);
      const firstBtn = screen.getByTestId("btn-first");

      // Flush requestAnimationFrame
      act(() => {
        vi.runAllTimers();
      });

      expect(document.activeElement).toBe(firstBtn);
    });

    it("wraps Tab from last element to first element", () => {
      render(<TestModalComponent isOpen={true} />);
      act(() => {
        vi.runAllTimers();
      });

      const firstBtn = screen.getByTestId("btn-first");
      const lastBtn = screen.getByTestId("btn-last");

      lastBtn.focus();
      expect(document.activeElement).toBe(lastBtn);

      // Press Tab on the last element
      fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
      expect(document.activeElement).toBe(firstBtn);
    });

    it("wraps Shift+Tab from first element to last element", () => {
      render(<TestModalComponent isOpen={true} />);
      act(() => {
        vi.runAllTimers();
      });

      const firstBtn = screen.getByTestId("btn-first");
      const lastBtn = screen.getByTestId("btn-last");

      firstBtn.focus();
      expect(document.activeElement).toBe(firstBtn);

      // Press Shift + Tab on first element
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(lastBtn);
    });

    it("calls onClose when Escape key is pressed", () => {
      const handleClose = vi.fn();
      render(<TestModalComponent isOpen={true} onClose={handleClose} />);

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("restores focus to the trigger element when modal closes", () => {
      const Harness = () => {
        const [open, setOpen] = useState(false);
        return (
          <div>
            <button data-testid="trigger-btn" onClick={() => setOpen(true)}>
              Open Modal
            </button>
            <TestModalComponent isOpen={open} onClose={() => setOpen(false)} />
          </div>
        );
      };

      render(<Harness />);
      const triggerBtn = screen.getByTestId("trigger-btn");
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      // Open modal
      fireEvent.click(triggerBtn);
      act(() => {
        vi.runAllTimers();
      });
      expect(document.activeElement).toBe(screen.getByTestId("btn-first"));

      // Close modal via Escape
      fireEvent.keyDown(window, { key: "Escape" });
      expect(document.activeElement).toBe(triggerBtn);
    });
  });
});
