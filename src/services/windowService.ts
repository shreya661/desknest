import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { saveQueue } from "../utils/saveQueue";

let isShuttingDown = false;
let unlistenClose: (() => void) | null = null;

export const windowService = {
  isTauri(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  },

  /**
   * Registers a safe close listener on the Tauri window.
   * Intercepts close requests, flushes pending saves, prevents repeated loops,
   * and blocks closure if saves fail so unsaved data is never lost.
   */
  async registerCloseProtection(
    onSaveFailed?: (errorMsg: string) => void
  ): Promise<() => void> {
    if (!this.isTauri()) {
      const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        if (saveQueue.isPending()) {
          e.preventDefault();
          e.returnValue = "";
        }
      };
      window.addEventListener("beforeunload", beforeUnloadHandler);
      return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
    }

    if (unlistenClose) {
      unlistenClose();
      unlistenClose = null;
    }

    try {
      const appWindow = getCurrentWindow();
      const unlisten = await appWindow.onCloseRequested(async (event) => {
        if (isShuttingDown) {
          // Already flushed successfully; allow closure without re-intercepting
          return;
        }

        // Prevent immediate close
        event.preventDefault();

        // Flush all pending and queued saves
        const success = await saveQueue.waitForPendingSaves(6000);

        if (success) {
          isShuttingDown = true;
          try {
            await appWindow.destroy();
          } catch (e) {
            console.warn("Could not destroy window on shutdown:", e);
          }
        } else {
          // Save failed: do NOT close window silently
          console.error("Pending saves failed or timed out during window close request.");
          const msg =
            "DeskNest could not complete pending saves before closing. Your changes have been recorded in recovery drafts. Please verify before exiting.";
          if (onSaveFailed) {
            onSaveFailed(msg);
          } else {
            alert(msg);
          }
        }
      });

      unlistenClose = unlisten;
      return () => {
        if (unlistenClose) {
          unlistenClose();
          unlistenClose = null;
        }
      };
    } catch (err) {
      console.warn("Could not register Tauri window close protection:", err);
      return () => {};
    }
  },

  async setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
    if (!this.isTauri()) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setAlwaysOnTop(alwaysOnTop);
    } catch (e) {
      console.warn("Could not set always on top:", e);
    }
  },

  async minimize(): Promise<void> {
    if (!this.isTauri()) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (e) {
      console.warn("Could not minimize window:", e);
    }
  },

  async toggleMaximize(): Promise<void> {
    if (!this.isTauri()) return;
    try {
      const appWindow = getCurrentWindow();
      const isMax = await appWindow.isMaximized();
      if (isMax) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (e) {
      console.warn("Could not toggle maximize:", e);
    }
  },

  async close(): Promise<void> {
    if (!this.isTauri()) {
      if (typeof window !== "undefined") {
        window.close();
      }
      return;
    }
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (e) {
      console.warn("Could not close window:", e);
    }
  },

  async setSize(width: number, height: number): Promise<void> {
    if (!this.isTauri()) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setSize(new LogicalSize(width, height));
    } catch (e) {
      console.warn("Could not set window size:", e);
    }
  },
};

