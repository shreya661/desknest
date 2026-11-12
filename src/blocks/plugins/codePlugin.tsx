import React from "react";
import { BlockPluginProps, DeskNestBlockPlugin } from "../blockRegistry";
import { Code, Copy, Check, Trash2 } from "lucide-react";
import { useBlockEngineContext } from "../BlockEngineContext";

export interface CodeBlockData {
  code: string;
  language: string;
}

const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "html",
  "css",
  "json",
  "markdown",
  "rust",
  "bash",
  "sql",
];

const CodeBlockComponent: React.FC<BlockPluginProps<CodeBlockData>> = ({
  data,
  onChange,
  onDelete,
  onFocus,
}) => {
  const { isReadOnly = false } = useBlockEngineContext();
  const [copied, setCopied] = React.useState(false);

  const code = data?.code || "";
  const language = data?.language || "typescript";

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full my-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-900 text-slate-100 overflow-hidden shadow-xs select-none">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-sky-400" />
          <select
            value={language}
            disabled={isReadOnly}
            onChange={(e) => onChange({ ...data, language: e.target.value })}
            className="bg-transparent text-slate-300 font-mono text-[11px] font-semibold focus:outline-none cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang} className="bg-slate-900 text-slate-100">
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            className="p-1 rounded text-slate-400 hover:text-slate-100 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {!isReadOnly && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete code block"
              className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <textarea
        value={code}
        disabled={isReadOnly}
        onFocus={onFocus}
        onChange={(e) => onChange({ ...data, code: e.target.value })}
        placeholder="// Write or paste code here..."
        rows={Math.max(3, code.split("\n").length)}
        spellCheck={false}
        className="w-full bg-transparent p-3 font-mono text-xs text-emerald-300 leading-relaxed resize-none focus:outline-none select-text"
      />
    </div>
  );
};

export const codeBlockPlugin: DeskNestBlockPlugin<CodeBlockData> = {
  type: "code",
  label: "Code Snippet",
  description: "Syntax highlighted code snippet block",
  shortcut: "/code",
  defaultData: () => ({ code: "", language: "typescript" }),
  toPlainText: (data) =>
    `\`\`\`${data?.language || ""}\n${data?.code || ""}\n\`\`\``,
  renderBlock: (props) => <CodeBlockComponent {...props} />,
};
