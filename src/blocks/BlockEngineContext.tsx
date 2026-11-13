import React, { createContext, useContext } from "react";
import { DrawingStroke } from "../types";

export interface SlashCommandState {
  blockId: string;
  query: string;
  slashIndex: number;
  cursorOffset: number;
  position: { top: number; left: number };
}

export interface BlockEngineContextValue {
  fontClass?: string;
  isReadOnly?: boolean;
  onCursorChange?: (cursorStart: number, cursorEnd?: number) => void;
  onUpdateDrawing?: (
    drawingId: string,
    strokes: DrawingStroke[],
    thumbnail?: string | null
  ) => void;
  onOpenFullCanvas?: (drawingId: string) => void;
  onToggleDisplayMode?: (blockId: string) => void;
  // Slash command integration
  slashCommandState?: SlashCommandState | null;
  onOpenSlashCommand?: (state: SlashCommandState) => void;
  onCloseSlashCommand?: () => void;
  onUpdateSlashQuery?: (query: string, cursorOffset: number) => void;
  onSelectSlashCommand?: (
    pluginType: string,
    targetState: SlashCommandState
  ) => void;
}

const BlockEngineContext = createContext<BlockEngineContextValue>({});

export const BlockEngineProvider: React.FC<{
  value: BlockEngineContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <BlockEngineContext.Provider value={value}>
      {children}
    </BlockEngineContext.Provider>
  );
};

export function useBlockEngineContext(): BlockEngineContextValue {
  return useContext(BlockEngineContext);
}
