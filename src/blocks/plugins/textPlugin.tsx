import React from "react";
import { BlockPluginProps, DeskNestBlockPlugin } from "../blockRegistry";
import { TextBlockItem } from "../../components/notes/blocks/TextBlockItem";
import { useBlockEngineContext } from "../BlockEngineContext";

export interface TextBlockData {
  content: string;
}

const TextBlockPluginComponent: React.FC<BlockPluginProps<TextBlockData>> = ({
  blockId,
  data,
  onChange,
  onFocus,
}) => {
  const { fontClass = "font-sans text-xs", isReadOnly = false, onCursorChange } =
    useBlockEngineContext();

  const content = data?.content || "";

  return (
    <TextBlockItem
      id={blockId}
      content={content}
      fontClass={fontClass}
      isReadOnly={isReadOnly}
      onChange={(_id, newContent) => {
        onChange({ content: newContent });
      }}
      onFocus={(_id, cursor) => {
        if (onFocus) onFocus();
        if (onCursorChange) onCursorChange(cursor, cursor);
      }}
      onCursorChange={(start, end) => {
        if (onCursorChange) onCursorChange(start, end);
      }}
    />
  );
};

export const textBlockPlugin: DeskNestBlockPlugin<TextBlockData> = {
  type: "text",
  label: "Text",
  description: "Markdown formatted text block with smart lists",
  shortcut: "/text",
  defaultData: () => ({ content: "" }),
  toPlainText: (data) => data?.content || "",
  renderBlock: (props) => <TextBlockPluginComponent {...props} />,
};

