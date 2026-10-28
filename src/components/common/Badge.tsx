import React from "react";

export interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "primary";
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  children,
  className = "",
}) => {
  const variants = {
    default: "bg-muted text-muted-fg border border-border",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    primary: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
