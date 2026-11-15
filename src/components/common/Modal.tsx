import React, { useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "md",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, modalRef, onClose);

  if (!isOpen) return null;

  const maxWidths = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative z-10 w-full max-w-[calc(100vw-24px)] ${maxWidths[maxWidth]} bg-surface rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[calc(100vh-32px)] focus:outline-none`}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border bg-surface-elevated">
          <h2 id="modal-title" className="text-sm sm:text-base font-semibold text-foreground tracking-tight">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full h-7 w-7 text-muted-fg hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
