import React from "react";
import { NoteBlock } from "../types";
import {
  getBlockPlugin,
  getBlockData,
  updateBlockData,
} from "./blockRegistry";
import { AlertCircle, Trash2 } from "lucide-react";

interface BlockRendererProps {
  block: NoteBlock;
  isFocused: boolean;
  onChange: (updatedBlock: NoteBlock) => void;
  onSplit?: () => void;
  onDelete?: () => void;
  onFocus?: () => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isFocused,
  onChange,
  onSplit,
  onDelete,
  onFocus,
}) => {
  const plugin = getBlockPlugin(block.type);

  if (!plugin) {
    return (
      <div className="w-full my-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>
            Unsupported block type: <code className="font-mono font-bold">{block.type}</code>
          </span>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Remove unsupported block"
            className="p-1 rounded text-muted-fg hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  const data = getBlockData(block);

  return (
    <div data-block-id={block.id} className="w-full relative group/block">
      {plugin.renderBlock({
        blockId: block.id,
        data,
        isFocused,
        onChange: (nextData) => {
          onChange(updateBlockData(block, nextData));
        },
        onSplit,
        onDelete,
        onFocus,
      })}
    </div>
  );
};
