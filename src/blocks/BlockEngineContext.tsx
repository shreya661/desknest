import React, { createContext, useContext } from "react";
import { DrawingStroke } from "../types";

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
