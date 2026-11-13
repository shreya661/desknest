import React from "react";
import { BlockPluginProps, DeskNestBlockPlugin } from "../blockRegistry";
import { DrawingBlockItem } from "../../components/notes/blocks/DrawingBlockItem";
import { useBlockEngineContext } from "../BlockEngineContext";

export interface DrawingBlockData {
  drawingId: string;
  title?: string;
  displayMode?: "inline" | "expanded";
}

const DrawingBlockPluginComponent: React.FC<BlockPluginProps<DrawingBlockData>> = ({
  blockId,
  data,
  onChange,
  onDelete,
}) => {
  const {
    isReadOnly = false,
    onUpdateDrawing,
    onOpenFullCanvas,
    onToggleDisplayMode,
  } = useBlockEngineContext();

  return (
    <DrawingBlockItem
      blockId={blockId}
      drawingId={data?.drawingId || ""}
      title={data?.title || "Embedded Sketch"}
      displayMode={data?.displayMode || "inline"}
      isReadOnly={isReadOnly}
      onUpdateDrawing={(dId, strokes, thumb) => {
        if (onUpdateDrawing) {
          onUpdateDrawing(dId, strokes, thumb);
        }
      }}
      onDeleteBlock={() => {
        if (onDelete) onDelete();
      }}
      onToggleDisplayMode={() => {
        if (onToggleDisplayMode) {
          onToggleDisplayMode(blockId);
        } else {
          onChange({
            ...data,
            displayMode: data?.displayMode === "expanded" ? "inline" : "expanded",
          });
        }
      }}
      onOpenFullCanvas={onOpenFullCanvas}
    />
  );
};

export const drawingBlockPlugin: DeskNestBlockPlugin<DrawingBlockData> = {
  type: "drawing",
  label: "Drawing / Sketch",
  description: "Interactive vector drawing canvas",
  shortcut: "/drawing",
  defaultData: () => ({
    drawingId: "",
    title: "Embedded Sketch",
    displayMode: "inline",
  }),
  toPlainText: (data) => {
    const title = data?.title || "Embedded Drawing";
    const id = data?.drawingId || "";
    return `![drawing:${id}](${title})`;
  },
  renderBlock: (props) => <DrawingBlockPluginComponent {...props} />,
};

