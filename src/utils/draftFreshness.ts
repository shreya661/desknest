import { Note, NoteDraftRecord } from "../types";
import { deriveNoteContent } from "./blockSplitting";

export interface DraftFreshnessResult {
  isFresh: boolean;
  reason: "no_draft" | "stale_timestamp" | "identical_content" | "newer_unsaved_edits";
}

/**
 * Evaluates whether a recovery draft contains valid, actionable unsaved changes.
 * Eliminates arbitrary delay thresholds so closely spaced saves (even 1ms)
 * are accurately distinguished based on timestamp ordering and actual content divergence.
 */
export function evaluateDraftFreshness(
  draft: NoteDraftRecord | null | undefined,
  note: Note
): DraftFreshnessResult {
  if (!draft) {
    return { isFresh: false, reason: "no_draft" };
  }

  const draftTime = new Date(draft.updatedAt).getTime();
  const noteTime = new Date(note.updatedAt).getTime();

  // If the draft timestamp is older than or equal to the saved note timestamp,
  // it is stale and must not overwrite the saved note.
  if (draftTime <= noteTime) {
    return { isFresh: false, reason: "stale_timestamp" };
  }

  // Content check: verify draft actually contains uncommitted text or title edits
  const draftContent = deriveNoteContent(draft.blocks || []);
  const noteContent = note.content || "";
  const isContentDifferent = draftContent.trim() !== noteContent.trim();
  const isTitleDifferent = (draft.title || "").trim() !== (note.title || "").trim();

  if (isContentDifferent || isTitleDifferent) {
    return { isFresh: true, reason: "newer_unsaved_edits" };
  }

  return { isFresh: false, reason: "identical_content" };
}
