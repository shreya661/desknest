import React, { useEffect, useState, useRef } from "react";
import { SlashCommandState } from "../../../blocks/BlockEngineContext";
import { getAllBlockPlugins, DeskNestBlockPlugin } from "../../../blocks/blockRegistry";
import {
  Code,
  PenTool,
  Kanban,
  Table as TableIcon,
  Sparkles,
  Type,
  FileText,
  LucideIcon,
} from "lucide-react";

interface SlashCommandMenuProps {
  state: SlashCommandState;
  onSelect: (pluginType: string, targetState: SlashCommandState) => void;
  onClose: () => void;
}

const PLUGIN_ICONS: Record<string, LucideIcon> = {
  text: Type,
  drawing: PenTool,
  code: Code,
  callout: Sparkles,
  kanban: Kanban,
  table: TableIcon,
};

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  state,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const allPlugins = getAllBlockPlugins();
  const query = state.query.toLowerCase().trim();

  // Filter plugins matching shortcut, label, type, or description
  const filteredPlugins = allPlugins.filter((plugin) => {
    if (!query) return true;
    const cleanShortcut = (plugin.shortcut || "").replace(/^\//, "").toLowerCase();
    return (
      cleanShortcut.includes(query) ||
      plugin.label.toLowerCase().includes(query) ||
      plugin.type.toLowerCase().includes(query) ||
      plugin.description.toLowerCase().includes(query)
    );
  });

  // Reset selected index when query / filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [state.query]);

  // Intercept Arrow keys, Enter, and Escape in capture phase before textarea
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) =>
          filteredPlugins.length > 0 ? (prev + 1) % filteredPlugins.length : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) =>
          filteredPlugins.length > 0
            ? (prev - 1 + filteredPlugins.length) % filteredPlugins.length
            : 0
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredPlugins.length > 0 && filteredPlugins[selectedIndex]) {
          onSelect(filteredPlugins[selectedIndex].type, state);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [filteredPlugins, selectedIndex, onSelect, onClose, state]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Viewport-aware positioning
  const top = Math.min(state.position.top + 24, window.innerHeight - 320);
  const left = Math.min(state.position.left, window.innerWidth - 300);

  return (
    <div
      ref={menuRef}
      style={{
        top: `${Math.max(16, top)}px`,
        left: `${Math.max(16, left)}px`,
      }}
      className="fixed z-50 w-72 bg-surface-elevated border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Header Info */}
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border/80 flex items-center justify-between text-[10px] text-muted-fg font-semibold uppercase tracking-wider">
        <span>Insert Block</span>
        <span>{filteredPlugins.length} available</span>
      </div>

      {/* Plugins List */}
      <div className="p-1 max-h-64 overflow-y-auto space-y-0.5">
        {filteredPlugins.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-fg italic">
            No matching blocks for "{state.query}"
          </div>
        ) : (
          filteredPlugins.map((plugin: DeskNestBlockPlugin, idx: number) => {
            const Icon = PLUGIN_ICONS[plugin.type] || FileText;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={plugin.type}
                type="button"
                onClick={() => onSelect(plugin.type, state)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <div
                  className={`p-1.5 rounded-md flex-shrink-0 mt-0.5 ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs truncate">
                      {plugin.label}
                    </span>
                    {plugin.shortcut && (
                      <span
                        className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-fg"
                        }`}
                      >
                        {plugin.shortcut}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[10px] line-clamp-1 mt-0.5 ${
                      isSelected ? "text-primary-foreground/80" : "text-muted-fg"
                    }`}
                  >
                    {plugin.description}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Navigation Hint */}
      <div className="px-3 py-1 bg-muted/20 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-fg">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>esc Close</span>
      </div>
    </div>
  );
};

