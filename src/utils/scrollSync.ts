/**
 * Proportional Split-View Scroll Synchronization Utilities (UI-01)
 */

/**
 * Calculates the synchronized scrollTop for a target pane based on the source pane's scroll ratio.
 *
 * formula: target.scrollTop = (source.scrollTop / (source.scrollHeight - source.clientHeight)) * (target.scrollHeight - target.clientHeight)
 *
 * Accurately handles edge cases such as:
 * - Zero denominator when source pane has no overflow
 * - Target pane smaller than client height
 * - Clamping ratio strictly between 0 and 1
 */
export function calculateSynchronizedScrollTop(
  sourceScrollTop: number,
  sourceScrollHeight: number,
  sourceClientHeight: number,
  targetScrollHeight: number,
  targetClientHeight: number
): number {
  const maxSourceScroll = Math.max(1, sourceScrollHeight - sourceClientHeight);
  const maxTargetScroll = Math.max(0, targetScrollHeight - targetClientHeight);

  if (maxTargetScroll === 0) {
    return 0;
  }

  const scrollRatio = Math.max(0, Math.min(1, sourceScrollTop / maxSourceScroll));
  return Math.round(scrollRatio * maxTargetScroll);
}
