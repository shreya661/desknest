import React from "react";
import { AlertTriangle } from "lucide-react";
import { NoteDraftRecord } from "../../../types";

export interface EditorRecoveryBannerProps {
  draftRecovery: NoteDraftRecord | null;
  fallbackAlert: string | null;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
}

export const EditorRecoveryBanner: React.FC<EditorRecoveryBannerProps> = ({
  draftRecovery,
  fallbackAlert,
  onRestoreDraft,
  onDiscardDraft,
}) => {
  return (
    <>
      {/* Durable Recovery Banner */}
      {draftRecovery && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/20 text-amber-900 dark:text-amber-100 text-xs border-b border-amber-500/30">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Unsaved changes recovered from{" "}
            {new Date(draftRecovery.updatedAt).toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRestoreDraft}
              className="px-2 py-0.5 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={onDiscardDraft}
              className="px-2 py-0.5 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 transition"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Fallback Notice Banner */}
      {fallbackAlert && (
        <div className="px-3 py-1 bg-sky-500/15 text-sky-900 dark:text-sky-100 text-xs border-b border-sky-500/30 flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>{fallbackAlert}</span>
        </div>
      )}
    </>
  );
};

