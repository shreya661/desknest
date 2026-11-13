import React from "react";
import { BlockPluginProps, DeskNestBlockPlugin } from "../blockRegistry";
import { Table as TableIcon, Plus, Minus, Trash2 } from "lucide-react";
import { useBlockEngineContext } from "../BlockEngineContext";

export interface TableBlockData {
  headers: string[];
  rows: string[][];
}

export const DEFAULT_TABLE_DATA: TableBlockData = {
  headers: ["Item", "Category", "Status"],
  rows: [
    ["App Architecture", "Design", "In Review"],
    ["Block Engine", "Core", "Completed"],
  ],
};

const TableBlockComponent: React.FC<BlockPluginProps<TableBlockData>> = ({
  data,
  onChange,
  onDelete,
}) => {
  const { isReadOnly = false } = useBlockEngineContext();

  const headers = data?.headers && data.headers.length > 0
    ? data.headers
    : DEFAULT_TABLE_DATA.headers;

  const rows = data?.rows ? data.rows : DEFAULT_TABLE_DATA.rows;

  const handleHeaderChange = (index: number, value: string) => {
    const nextHeaders = [...headers];
    nextHeaders[index] = value;
    onChange({ headers: nextHeaders, rows });
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = rows.map((r, rIdx) => {
      if (rIdx === rowIndex) {
        const nextRow = [...r];
        nextRow[colIndex] = value;
        return nextRow;
      }
      return r;
    });
    onChange({ headers, rows: nextRows });
  };

  const handleAddColumn = () => {
    const nextHeaders = [...headers, `Column ${headers.length + 1}`];
    const nextRows = rows.map((r) => [...r, ""]);
    onChange({ headers: nextHeaders, rows: nextRows });
  };

  const handleRemoveColumn = () => {
    if (headers.length <= 1) return;
    const nextHeaders = headers.slice(0, -1);
    const nextRows = rows.map((r) => r.slice(0, -1));
    onChange({ headers: nextHeaders, rows: nextRows });
  };

  const handleAddRow = () => {
    const emptyRow = new Array(headers.length).fill("");
    const nextRows = [...rows, emptyRow];
    onChange({ headers, rows: nextRows });
  };

  const handleRemoveRow = () => {
    if (rows.length <= 1) return;
    const nextRows = rows.slice(0, -1);
    onChange({ headers, rows: nextRows });
  };

  return (
    <div className="w-full my-3 rounded-xl border border-border bg-surface-elevated overflow-hidden shadow-xs select-none">
      {/* Table Action Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-primary" />
          <span className="font-semibold text-xs text-foreground">
            Table Grid
          </span>
          <span className="text-[10px] text-muted-fg font-mono">
            ({headers.length} cols × {rows.length} rows)
          </span>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-surface border border-border rounded-md px-1 py-0.5 text-[10px] text-muted-fg">
              <span>Cols:</span>
              <button
                type="button"
                onClick={handleAddColumn}
                title="Add Column"
                className="p-0.5 hover:text-primary transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={headers.length <= 1}
                onClick={handleRemoveColumn}
                title="Remove Column"
                className="p-0.5 hover:text-rose-500 disabled:opacity-30 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-1 bg-surface border border-border rounded-md px-1 py-0.5 text-[10px] text-muted-fg">
              <span>Rows:</span>
              <button
                type="button"
                onClick={handleAddRow}
                title="Add Row"
                className="p-0.5 hover:text-primary transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={rows.length <= 1}
                onClick={handleRemoveRow}
                title="Remove Row"
                className="p-0.5 hover:text-rose-500 disabled:opacity-30 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Delete Table"
                className="p-1 rounded text-muted-fg hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editable Table Grid */}
      <div className="overflow-x-auto p-2">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {headers.map((h, colIdx) => (
                <th key={colIdx} className="p-1.5 text-left font-semibold text-foreground">
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={h}
                    onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                    placeholder={`Header ${colIdx + 1}`}
                    className="w-full bg-transparent font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="border-b border-border/40 hover:bg-muted/10 transition-colors"
              >
                {headers.map((_, cIdx) => (
                  <td key={cIdx} className="p-1.5">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={row[cIdx] || ""}
                      onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                      placeholder="..."
                      className="w-full bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 rounded px-1.5 py-0.5 text-xs"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const tablePlugin: DeskNestBlockPlugin<TableBlockData> = {
  type: "table",
  label: "Table Grid",
  description: "Editable rows and columns data table",
  shortcut: "/table",
  defaultData: () => ({
    headers: ["Column 1", "Column 2", "Column 3"],
    rows: [
      ["", "", ""],
      ["", "", ""],
    ],
  }),
  toPlainText: (data: TableBlockData) => {
    if (!data || !data.headers || data.headers.length === 0) return "";
    const headers = `| ${data.headers.map((h) => h || " ").join(" | ")} |`;
    const separator = `| ${data.headers.map(() => "---").join(" | ")} |`;
    const rows = (data.rows || [])
      .map((row) => {
        const paddedRow = data.headers.map((_, i) => row[i] || "");
        return `| ${paddedRow.map((c) => c || " ").join(" | ")} |`;
      })
      .join("\n");
    return rows ? `${headers}\n${separator}\n${rows}` : `${headers}\n${separator}`;
  },
  renderBlock: (props) => <TableBlockComponent {...props} />,
};

