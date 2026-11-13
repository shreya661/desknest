import React, { useState } from "react";
import { BlockPluginProps, DeskNestBlockPlugin } from "../blockRegistry";
import {
  Kanban,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useBlockEngineContext } from "../BlockEngineContext";

export interface KanbanCard {
  id: string;
  text: string;
  done?: boolean;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBlockData {
  columns: KanbanColumn[];
}

export const DEFAULT_KANBAN_DATA: KanbanBlockData = {
  columns: [
    {
      id: "col_todo",
      title: "To Do",
      cards: [{ id: "card_1", text: "Plan project roadmap", done: false }],
    },
    {
      id: "col_progress",
      title: "In Progress",
      cards: [{ id: "card_2", text: "Build block components", done: false }],
    },
    {
      id: "col_done",
      title: "Done",
      cards: [{ id: "card_3", text: "Initialize DeskNest", done: true }],
    },
  ],
};

const KanbanBlockComponent: React.FC<BlockPluginProps<KanbanBlockData>> = ({
  data,
  onChange,
  onDelete,
}) => {
  const { isReadOnly = false } = useBlockEngineContext();
  const [newCardTexts, setNewCardTexts] = useState<Record<string, string>>({});

  const columns = data?.columns && data.columns.length > 0
    ? data.columns
    : DEFAULT_KANBAN_DATA.columns;

  const updateColumns = (nextCols: KanbanColumn[]) => {
    onChange({ columns: nextCols });
  };

  const handleAddCard = (colId: string) => {
    const text = (newCardTexts[colId] || "").trim();
    if (!text) return;

    const nextCols = columns.map((col) => {
      if (col.id === colId) {
        return {
          ...col,
          cards: [
            ...col.cards,
            { id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), text, done: false },
          ],
        };
      }
      return col;
    });

    updateColumns(nextCols);
    setNewCardTexts((prev) => ({ ...prev, [colId]: "" }));
  };

  const handleToggleCardDone = (colIndex: number, cardIndex: number) => {
    const nextCols = [...columns];
    const targetCol = { ...nextCols[colIndex] };
    const targetCard = { ...targetCol.cards[cardIndex] };
    targetCard.done = !targetCard.done;
    targetCol.cards = [...targetCol.cards];
    targetCol.cards[cardIndex] = targetCard;
    nextCols[colIndex] = targetCol;
    updateColumns(nextCols);
  };

  const handleUpdateCardText = (colIndex: number, cardIndex: number, newText: string) => {
    const nextCols = [...columns];
    const targetCol = { ...nextCols[colIndex] };
    targetCol.cards = [...targetCol.cards];
    targetCol.cards[cardIndex] = { ...targetCol.cards[cardIndex], text: newText };
    nextCols[colIndex] = targetCol;
    updateColumns(nextCols);
  };

  const handleDeleteCard = (colIndex: number, cardIndex: number) => {
    const nextCols = [...columns];
    const targetCol = { ...nextCols[colIndex] };
    targetCol.cards = targetCol.cards.filter((_, idx) => idx !== cardIndex);
    nextCols[colIndex] = targetCol;
    updateColumns(nextCols);
  };

  const handleMoveCard = (fromColIndex: number, cardIndex: number, direction: "left" | "right") => {
    const toColIndex = direction === "left" ? fromColIndex - 1 : fromColIndex + 1;
    if (toColIndex < 0 || toColIndex >= columns.length) return;

    const nextCols = columns.map((col) => ({ ...col, cards: [...col.cards] }));
    const [cardToMove] = nextCols[fromColIndex].cards.splice(cardIndex, 1);
    nextCols[toColIndex].cards.push(cardToMove);
    updateColumns(nextCols);
  };

  return (
    <div className="w-full my-3 rounded-xl border border-border bg-surface-elevated overflow-hidden shadow-xs select-none">
      {/* Kanban Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Kanban className="w-4 h-4 text-primary" />
          <span className="font-semibold text-xs tracking-tight text-foreground">
            Kanban Board
          </span>
          <span className="text-[10px] text-muted-fg font-mono">
            ({columns.reduce((acc, col) => acc + col.cards.length, 0)} cards)
          </span>
        </div>

        {!isReadOnly && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete Kanban Board"
            className="p-1 rounded text-muted-fg hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 3 Columns Board */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {columns.map((col, colIdx) => (
          <div
            key={col.id}
            className="flex flex-col bg-surface border border-border rounded-lg p-2.5 min-h-[140px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/60">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    colIdx === 0
                      ? "bg-amber-400"
                      : colIdx === 1
                      ? "bg-sky-400"
                      : "bg-emerald-400"
                  }`}
                />
                {col.title}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono text-muted-fg">
                {col.cards.length}
              </span>
            </div>

            {/* Cards List */}
            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-64 pr-0.5">
              {col.cards.map((card, cardIdx) => (
                <div
                  key={card.id}
                  className="group/card p-2 rounded-md bg-surface-elevated border border-border/80 hover:border-primary/40 transition-colors flex flex-col gap-1.5 shadow-2xs"
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleToggleCardDone(colIdx, cardIdx)}
                      className="mt-0.5 text-muted-fg hover:text-primary transition-colors flex-shrink-0"
                    >
                      {card.done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Circle className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={card.text}
                      onChange={(e) => handleUpdateCardText(colIdx, cardIdx, e.target.value)}
                      className={`w-full bg-transparent text-xs text-foreground focus:outline-none ${
                        card.done ? "line-through text-muted-fg opacity-60" : ""
                      }`}
                    />
                  </div>

                  {/* Card Actions: Move left, Move right, Delete */}
                  {!isReadOnly && (
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-fg opacity-70 group-hover/card:opacity-100 transition-opacity">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={colIdx === 0}
                          onClick={() => handleMoveCard(colIdx, cardIdx, "left")}
                          title="Move left"
                          className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={colIdx === columns.length - 1}
                          onClick={() => handleMoveCard(colIdx, cardIdx, "right")}
                          title="Move right"
                          className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCard(colIdx, cardIdx)}
                        title="Delete card"
                        className="p-0.5 rounded hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Add Card Input */}
            {!isReadOnly && (
              <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center gap-1">
                <input
                  type="text"
                  placeholder="+ Add card..."
                  value={newCardTexts[col.id] || ""}
                  onChange={(e) =>
                    setNewCardTexts((prev) => ({ ...prev, [col.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCard(col.id);
                    }
                  }}
                  className="flex-1 bg-surface-elevated border border-border/70 rounded px-1.5 py-1 text-[11px] text-foreground placeholder:text-muted-fg/70 focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => handleAddCard(col.id)}
                  title="Add card"
                  className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const kanbanPlugin: DeskNestBlockPlugin<KanbanBlockData> = {
  type: "kanban",
  label: "Kanban Board",
  description: "3-column interactive task board",
  shortcut: "/kanban",
  defaultData: () => ({
    columns: [
      { id: "col_todo", title: "To Do", cards: [] },
      { id: "col_progress", title: "In Progress", cards: [] },
      { id: "col_done", title: "Done", cards: [] },
    ],
  }),
  toPlainText: (data: KanbanBlockData) => {
    if (!data || !data.columns || data.columns.length === 0) return "";
    return data.columns
      .map((col) => {
        const title = `### ${col.title}`;
        const cards = (col.cards || [])
          .map((c) => `- [${c.done ? "x" : " "}] ${c.text || "Untitled Task"}`)
          .join("\n");
        return cards ? `${title}\n${cards}` : title;
      })
      .join("\n\n");
  },
  renderBlock: (props) => <KanbanBlockComponent {...props} />,
};

