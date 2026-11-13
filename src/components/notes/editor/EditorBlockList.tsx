import React, { useState } from "react";
import { NoteBlock, DrawingStroke } from "../../../types";
import { BlockRenderer } from "../../../blocks/BlockRenderer";
import { BlockEngineProvider, SlashCommandState, BlockEngineContextValue } from "../../../blocks/BlockEngineContext";
import { getAllBlockPlugins } from "../../../blocks/blockRegistry";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { Plus } from "lucide-react";

export interface EditorBlockListProps {
  blocks: NoteBlock[];
  activeBlockId: string | null;
  fontClass: string;
  isReadOnly?: boolean;
  onBlockChange: (updatedBlock: NoteBlock) => void;
  onBlockFocus: (blockId: string) => void;
  onCursorChange: (cursorStart: number, cursorEnd?: number) => void;
  onDeleteBlock: (blockId: string) => void;
  onUpdateDrawing: (
    drawingId: string,
    strokes: DrawingStroke[],
    thumbnail?: string | null
  ) => void;
  onOpenFullCanvas?: (drawingId: string) => void;
  onToggleDisplayMode?: (blockId: string) => void;
  onAddBlock?: (type: string) => void;
  onSelectSlashCommand?: (pluginType: string, state: SlashCommandState) => void;
}

export const EditorBlockList: React.FC<EditorBlockListProps> = ({
  blocks,
  activeBlockId,
  fontClass,
  isReadOnly = false,
  onBlockChange,
  onBlockFocus,
  onCursorChange,
  onDeleteBlock,
  onUpdateDrawing,
  onOpenFullCanvas,
  onToggleDisplayMode,
  onAddBlock,
  onSelectSlashCommand,
}) => {
  const [slashCommandState, setSlashCommandState] = useState<SlashCommandState | null>(null);

  const contextValue: BlockEngineContextValue = {
    fontClass,
    isReadOnly,
    onCursorChange,
    onUpdateDrawing,
    onOpenFullCanvas,
    onToggleDisplayMode,
    slashCommandState,
    onOpenSlashCommand: setSlashCommandState,
    onCloseSlashCommand: () => setSlashCommandState(null),
    onUpdateSlashQuery: (query, cursorOffset) => {
      setSlashCommandState((prev) =>
        prev ? { ...prev, query, cursorOffset } : null
      );
    },
    onSelectSlashCommand: (pluginType, targetState) => {
      setSlashCommandState(null);
      if (onSelectSlashCommand) {
        onSelectSlashCommand(pluginType, targetState);
      }
    },
  };

  const availablePlugins = getAllBlockPlugins();

  return (
    <BlockEngineProvider value={contextValue}>
      <div className="flex-1 flex flex-col h-full overflow-y-auto pr-1 relative">
        {blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            isFocused={activeBlockId === block.id}
            onChange={onBlockChange}
            onFocus={() => onBlockFocus(block.id)}
            onDelete={() => onDeleteBlock(block.id)}
          />
        ))}

        {/* Floating Slash Command Menu */}
        {slashCommandState && (
          <SlashCommandMenu
            state={slashCommandState}
            onSelect={(pluginType, targetState) => {
              setSlashCommandState(null);
              if (onSelectSlashCommand) {
                onSelectSlashCommand(pluginType, targetState);
              }
            }}
            onClose={() => setSlashCommandState(null)}
          />
        )}

        {/* Add Block Footer Button */}
        {!isReadOnly && onAddBlock && (
          <div className="pt-2 pb-6 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-muted-fg font-semibold uppercase tracking-wider mr-1">
              Add Block:
            </span>
            {availablePlugins.map((plugin) => (
              <button
                key={plugin.type}
                type="button"
                onClick={() => onAddBlock(plugin.type)}
                title={`Add ${plugin.label}`}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-fg hover:text-foreground transition-colors flex items-center gap-1 border border-black/5 dark:border-white/5"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{plugin.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </BlockEngineProvider>
  );
};

