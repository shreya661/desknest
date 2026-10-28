import React from "react";
import { Bell, X, Clock, Check } from "lucide-react";
import { Button } from "./Button";

export interface ToastItem {
  id: string;
  reminderId: string;
  title: string;
  description: string;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onSnooze: (reminderId: string, toastId: string, minutes: number) => void;
  onComplete: (reminderId: string, toastId: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  toasts,
  onDismiss,
  onSnooze,
  onComplete,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-surface-elevated text-foreground border border-primary/50 shadow-2xl rounded-xl p-3.5 flex flex-col gap-2 animate-in slide-in-from-bottom-3 duration-200"
          role="alert"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">{toast.title}</h4>
                {toast.description && (
                  <p className="text-[11px] text-muted-fg mt-0.5">{toast.description}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded text-muted-fg hover:text-foreground"
              aria-label="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSnooze(toast.reminderId, toast.id, 10)}
              className="text-[10px] h-6 px-2"
            >
              <Clock className="w-2.5 h-2.5" />
              <span>Snooze 10m</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onComplete(toast.reminderId, toast.id)}
              className="text-[10px] h-6 px-2"
            >
              <Check className="w-2.5 h-2.5" />
              <span>Done</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
