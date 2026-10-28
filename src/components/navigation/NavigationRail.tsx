import React, { useState } from "react";
import {
  Home,
  FileText,
  PenTool,
  CheckSquare,
  Bell,
  Search,
  Settings,
  Mic,
  Headphones,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";
import { WorkspaceType } from "../../types";

interface NavigationRailProps {
  activeWorkspace: WorkspaceType;
  onSelectWorkspace: (workspace: WorkspaceType) => void;
  pendingTasksCount: number;
  activeRemindersCount: number;
  notesCount?: number;
  compactMode: boolean;
  onOpenVoiceRecorder: () => void;
  onOpenFocus: () => void;
  onOpenTemplates: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeWorkspace,
  onSelectWorkspace,
  pendingTasksCount,
  activeRemindersCount,
  notesCount = 0,
  compactMode,
  onOpenVoiceRecorder,
  onOpenFocus,
  onOpenTemplates,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const mainItems: {
    id: WorkspaceType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    color?: string;
  }[] = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "notes", label: "All Notes", icon: FileText, badge: notesCount },
    { id: "drawing", label: "Sketch Canvas", icon: PenTool },
    { id: "tasks", label: "Daily Tasks", icon: CheckSquare, badge: pendingTasksCount },
    { id: "reminders", label: "Reminders", icon: Bell, badge: activeRemindersCount },
  ];

  const addonTools = [
    {
      id: "voice",
      label: "Voice Studio",
      icon: Mic,
      action: onOpenVoiceRecorder,
      color: "text-rose-500",
      badge: "Rec",
    },
    {
      id: "focus",
      label: "Focus & Audio",
      icon: Headphones,
      action: onOpenFocus,
      color: "text-indigo-500",
    },
    {
      id: "templates",
      label: "Templates",
      icon: FileSpreadsheet,
      action: onOpenTemplates,
      color: "text-amber-500",
    },
  ];

  // Horizontal bar if in compact widget mode
  if (compactMode) {
    return (
      <nav
        aria-label="Compact Workspaces"
        className="h-11 bg-surface/90 backdrop-blur-md border-b border-border flex items-center justify-around px-2 select-none flex-shrink-0 z-30"
      >
        {mainItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeWorkspace === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectWorkspace(item.id)}
              title={item.label}
              className={`relative p-2 rounded-xl transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-4 h-4" />
              {!!item.badge && item.badge > 0 && !isActive && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border border-surface" />
              )}
            </button>
          );
        })}

        <div className="w-[1px] h-4 bg-border mx-1" />

        <button
          onClick={onOpenVoiceRecorder}
          title="Voice Studio & Saver"
          className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenFocus}
          title="Focus Sanctuary & Ambient Audio"
          className="p-2 rounded-xl text-indigo-500 hover:bg-indigo-500/10 transition-colors"
        >
          <Headphones className="w-4 h-4" />
        </button>
      </nav>
    );
  }

  // Modern Expandable Left Sidebar
  return (
    <aside
      aria-label="Workspace Navigation Sidebar"
      className={`${
        isExpanded ? "w-52" : "w-16"
      } bg-surface/80 backdrop-blur-xl border-r border-border flex flex-col justify-between py-3.5 select-none flex-shrink-0 z-30 transition-all duration-300 shadow-sm`}
    >
      {/* Top Main Navigation */}
      <div className="space-y-4 px-2">
        {/* Workspace Items Section */}
        <div>
          {isExpanded && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-fg px-2.5 mb-1.5 block">
              Workspace
            </span>
          )}
          <div className="space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeWorkspace === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectWorkspace(item.id)}
                  title={item.label}
                  className={`relative w-full h-9 rounded-xl flex items-center px-2.5 gap-2.5 transition-all text-xs font-semibold ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {isExpanded && <span className="truncate">{item.label}</span>}
                  {!!item.badge && item.badge > 0 && (
                    <span
                      className={`ml-auto px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-foreground text-background"
                          : "bg-surface-elevated text-foreground border border-border"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Addon Studio Tools Section */}
        <div>
          {isExpanded && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-fg px-2.5 mb-1.5 block flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-500" />
              <span>Add-ons & Studio</span>
            </span>
          )}
          <div className="space-y-1">
            {addonTools.map((addon) => {
              const Icon = addon.icon;
              return (
                <button
                  key={addon.id}
                  onClick={addon.action}
                  title={addon.label}
                  className="relative w-full h-9 rounded-xl flex items-center px-2.5 gap-2.5 transition-all text-xs font-medium text-muted-fg hover:text-foreground hover:bg-surface-hover group"
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${addon.color} group-hover:scale-110 transition-transform`} />
                  {isExpanded && <span className="truncate">{addon.label}</span>}
                  {isExpanded && addon.badge && (
                    <span className="ml-auto text-[9px] font-bold uppercase bg-rose-500/15 text-rose-500 px-1 rounded">
                      {addon.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Utility Actions */}
      <div className="px-2 pt-2 border-t border-border space-y-1">
        <button
          onClick={() => onSelectWorkspace("search")}
          title="Search All (Ctrl+F)"
          className={`w-full h-8 rounded-xl flex items-center px-2.5 gap-2.5 transition-all text-xs ${
            activeWorkspace === "search"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {isExpanded && <span>Search</span>}
        </button>

        <button
          onClick={() => onSelectWorkspace("settings")}
          title="Settings & Backups"
          className={`w-full h-8 rounded-xl flex items-center px-2.5 gap-2.5 transition-all text-xs ${
            activeWorkspace === "settings"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {isExpanded && <span>Settings</span>}
        </button>

        {/* Sidebar Collapse/Expand Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          className="w-full h-8 rounded-xl flex items-center justify-center text-muted-fg hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          {isExpanded ? (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-fg">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Collapse</span>
            </div>
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </aside>
  );
};
