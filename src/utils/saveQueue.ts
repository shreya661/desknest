/**
 * Monotonic Save Queue Mutex for DeskNest
 * Ensures asynchronous persistence operations execute in strict sequential order.
 * Prevents race conditions where older writes could overwrite newer edits.
 */

interface QueuedTask<T> {
  seqId: number;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export class SaveQueue {
  private currentSeqId = 0;
  private queue: QueuedTask<any>[] = [];
  private isProcessing = false;
  private hasFailure = false;
  private flushHooks: Set<() => Promise<void>> = new Set();

  /**
   * Registers a flush hook (e.g. from an active editor) to execute immediately
   * before close-protection flushes the queue.
   */
  public registerFlushHook(hook: () => Promise<void>): () => void {
    this.flushHooks.add(hook);
    return () => {
      this.flushHooks.delete(hook);
    };
  }

  /**
   * Enqueue a save task. Tasks are executed strictly in order of seqId.
   */
  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    const seqId = ++this.currentSeqId;

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        seqId,
        task,
        resolve,
        reject,
      });

      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift()!;

    (async () => {
      try {
        const result = await item.task();
        item.resolve(result);
      } catch (err) {
        this.hasFailure = true;
        item.reject(err);
      } finally {
        this.isProcessing = false;
        this.processNext();
      }
    })();
  }

  /**
   * Checks whether there are active or queued save operations.
   */
  public isPending(): boolean {
    return this.isProcessing || this.queue.length > 0;
  }

  /**
   * Returns current queue length.
   */
  public getPendingCount(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  /**
   * Waits for all currently pending, debounced, and queued saves to complete.
   * First triggers any registered flush hooks (to capture pending debounces),
   * then drains the queue sequentially.
   * Returns true if all completed successfully, false if timed out or failed.
   */
  public async waitForPendingSaves(timeoutMs = 6000): Promise<boolean> {
    const startTime = Date.now();
    this.hasFailure = false;

    // 1. Trigger all registered flush hooks (e.g., active debounced editor timers)
    if (this.flushHooks.size > 0) {
      const hooks = Array.from(this.flushHooks);
      await Promise.all(
        hooks.map(async (hook) => {
          try {
            await hook();
          } catch (err) {
            console.warn("[SaveQueue] Error executing flush hook:", err);
            this.hasFailure = true;
          }
        })
      );
    }

    // 2. Wait until all queued writes have resolved
    while (this.isPending()) {
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`[SaveQueue] waitForPendingSaves timed out after ${timeoutMs}ms`);
        return false;
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    return !this.hasFailure;
  }
}

export const saveQueue = new SaveQueue();

