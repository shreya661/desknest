import React from "react";
import { CheckSquare, Square, Copy, Sparkles, Lightbulb, AlertTriangle, Quote, Terminal } from "lucide-react";
import { NoteFontStyle } from "../../types";
import { getTextColorClass, TextColor } from "../../utils/markdownFormatting";

interface MarkdownRendererProps {
  content: string;
  fontStyle?: NoteFontStyle;
  onToggleChecklist?: (lineIndex: number, completed: boolean) => void;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  fontStyle = "sans",
  onToggleChecklist,
  className = "",
}) => {
  const getFontFamilyStyle = () => {
    switch (fontStyle) {
      case "serif":
        return { fontFamily: 'Georgia, Cambria, "Times New Roman", serif' };
      case "mono":
        return { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' };
      case "casual":
        return { fontFamily: '"Caveat", "Segoe Print", "Bradley Hand", cursive, sans-serif' };
      default:
        return { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
    }
  };

  // Helper to parse inline markdown (colors, highlight, underline, bold, italic, strike, code)
  const renderInlineFormatted = (text: string): React.ReactNode[] => {
    // Regex matching colors, highlights, underline, bold-italic, bold, italic, strike, code
    const tokenRegex = /(\[color:(?:rose|amber|emerald|sky|purple)\s+[^\]]+\]|==[^=]+==|<u>[^<]+<\/u>|__[^_]+__|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Safe Text Color: [color:rose text]
      if (part.startsWith("[color:") && part.endsWith("]")) {
        const colorMatch = part.match(/^\[color:(rose|amber|emerald|sky|purple)\s+([\s\S]+)\]$/);
        if (colorMatch) {
          const colorName = colorMatch[1] as TextColor;
          const innerContent = colorMatch[2];
          return (
            <span key={index} className={getTextColorClass(colorName)}>
              {renderInlineFormatted(innerContent)}
            </span>
          );
        }
      }

      // Highlighted Text: ==text==
      if (part.startsWith("==") && part.endsWith("==") && part.length >= 4) {
        const innerContent = part.slice(2, -2);
        return (
          <mark
            key={index}
            className="bg-yellow-200/90 dark:bg-yellow-400/25 text-yellow-950 dark:text-yellow-100 px-1 py-0.5 rounded font-medium border border-yellow-300/40 dark:border-yellow-400/30 select-text"
          >
            {renderInlineFormatted(innerContent)}
          </mark>
        );
      }

      // Underline: <u>text</u> or __text__
      if (
        (part.startsWith("<u>") && part.endsWith("</u>") && part.length >= 7) ||
        (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
      ) {
        const innerContent = part.startsWith("<u>") ? part.slice(3, -4) : part.slice(2, -2);
        return (
          <u key={index} className="underline decoration-current underline-offset-2">
            {renderInlineFormatted(innerContent)}
          </u>
        );
      }

      // Bold + Italic: ***text***
      if (part.startsWith("***") && part.endsWith("***") && part.length >= 6) {
        return (
          <strong key={index} className="font-bold italic text-foreground">
            {renderInlineFormatted(part.slice(3, -3))}
          </strong>
        );
      }
      // Bold: **text**
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return (
          <strong key={index} className="font-bold text-foreground">
            {renderInlineFormatted(part.slice(2, -2))}
          </strong>
        );
      }
      // Italic: *text*
      if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
        return (
          <em key={index} className="italic text-foreground">
            {renderInlineFormatted(part.slice(1, -1))}
          </em>
        );
      }
      // Strikethrough: ~~text~~
      if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
        return (
          <del key={index} className="line-through text-muted-fg opacity-75">
            {renderInlineFormatted(part.slice(2, -2))}
          </del>
        );
      }
      // Inline Code: `text`
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px] text-sky-600 dark:text-sky-400 border border-black/5 dark:border-white/5"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let inCalloutBlock = false;
  let calloutType: "keypoint" | "idea" | "quote" | "warning" | "default" = "default";
  let calloutLines: string[] = [];

  const flushCallout = (key: string) => {
    if (calloutLines.length === 0) return;

    let icon = <Quote className="w-4 h-4" />;
    let borderClass = "border-l-4 border-slate-400 bg-black/[0.03] dark:bg-white/[0.03]";
    let title = "";

    if (calloutType === "keypoint") {
      icon = <Sparkles className="w-4 h-4 text-amber-500" />;
      borderClass = "border-amber-400 bg-amber-500/10 dark:bg-amber-500/15 text-amber-900 dark:text-amber-100";
      title = "KEY TAKEAWAY";
    } else if (calloutType === "idea") {
      icon = <Lightbulb className="w-4 h-4 text-indigo-500" />;
      borderClass = "border-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-100";
      title = "IDEA & INSPIRATION";
    } else if (calloutType === "warning") {
      icon = <AlertTriangle className="w-4 h-4 text-rose-500" />;
      borderClass = "border-rose-400 bg-rose-500/10 dark:bg-rose-500/15 text-rose-900 dark:text-rose-100";
      title = "IMPORTANT DETAIL";
    } else if (calloutType === "quote") {
      icon = <Quote className="w-4 h-4 text-purple-500" />;
      borderClass = "border-purple-400 bg-purple-500/10 dark:bg-purple-500/15 text-purple-900 dark:text-purple-100 italic";
    }

    renderedElements.push(
      <div
        key={`callout-${key}`}
        className={`p-3 rounded-xl border border-border/80 my-2.5 transition-all ${borderClass}`}
      >
        {title && (
          <div className="flex items-center gap-1.5 font-bold text-[11px] tracking-wider uppercase mb-1">
            {icon}
            <span>{title}</span>
          </div>
        )}
        <div className="text-xs leading-relaxed space-y-1">
          {calloutLines.map((cLine, idx) => (
            <p key={idx}>{renderInlineFormatted(cLine)}</p>
          ))}
        </div>
      </div>
    );

    calloutLines = [];
    inCalloutBlock = false;
    calloutType = "default";
  };

  const flushCodeBlock = (key: string) => {
    const codeString = codeBlockLines.join("\n");
    renderedElements.push(
      <div
        key={`code-${key}`}
        className="my-3 rounded-xl overflow-hidden border border-border bg-slate-950 text-slate-100 font-mono text-[11px] shadow-sm"
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 select-none">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-sky-400" /> Code Snippet
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(codeString)}
            title="Copy code"
            className="hover:text-white transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
        <pre className="p-3 overflow-x-auto leading-relaxed">
          <code>{codeString}</code>
        </pre>
      </div>
    );
    codeBlockLines = [];
    inCodeBlock = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check code blocks ```
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock(`${i}`);
      } else {
        if (inCalloutBlock) flushCallout(`${i}`);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Check Callout / Blockquotes >
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s?/, "");

      if (!inCalloutBlock) {
        inCalloutBlock = true;
        if (quoteText.includes("KEY TAKEAWAY") || quoteText.includes("📌")) {
          calloutType = "keypoint";
        } else if (quoteText.includes("IDEA") || quoteText.includes("💡")) {
          calloutType = "idea";
        } else if (quoteText.includes("IMPORTANT") || quoteText.includes("⚠️")) {
          calloutType = "warning";
        } else if (quoteText.includes("💬") || quoteText.startsWith('"')) {
          calloutType = "quote";
        } else {
          calloutType = "default";
        }
      }
      calloutLines.push(quoteText);
      continue;
    } else if (inCalloutBlock) {
      flushCallout(`${i}`);
    }

    // Embedded Drawing Block: ![drawing:id](title)
    const drawingMatch = trimmed.match(/^!\[drawing:([^\]]+)\](?:\(([^)]*)\))?$/);
    if (drawingMatch) {
      const drawingId = drawingMatch[1];
      const drawingTitle = drawingMatch[2] || "Embedded Drawing";
      renderedElements.push(
        <div
          key={`draw-${i}`}
          className="my-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs"
        >
          <div className="flex items-center space-x-2">
            <span className="text-base">🎨</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {drawingTitle}
            </span>
          </div>
          <span className="text-[10px] text-muted-fg font-mono">[{drawingId}]</span>
        </div>
      );
      continue;
    }

    // Indentation calculation for nested list items
    const indentSpaces = rawLine.match(/^(\s*)/)?.[1].length || 0;
    const indentLevel = Math.min(6, Math.floor(indentSpaces / 2));
    const indentPadding = `${indentLevel * 16 + 8}px`;

    // Heading 1: #
    if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h1 key={`h1-${i}`} className="text-xl sm:text-2xl font-extrabold text-foreground mt-5 mb-2 tracking-tight border-b border-black/10 dark:border-white/10 pb-1.5">
          {renderInlineFormatted(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Heading 2: ##
    if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h2 key={`h2-${i}`} className="text-base sm:text-lg font-bold text-foreground mt-4 mb-1.5 tracking-tight border-b border-black/5 dark:border-white/5 pb-1">
          {renderInlineFormatted(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    // Heading 3: ###
    if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-foreground/90 mt-3 mb-1">
          {renderInlineFormatted(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    // Interactive Checklists: - [ ] or - [x]
    const checklistMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (checklistMatch) {
      const isChecked = checklistMatch[1].toLowerCase() === "x";
      const checkText = checklistMatch[2];
      const lineIndex = i;

      renderedElements.push(
        <div
          key={`check-${i}`}
          style={{ paddingLeft: indentPadding }}
          onClick={() => onToggleChecklist && onToggleChecklist(lineIndex, !isChecked)}
          className={`flex items-start gap-2.5 py-1 px-1.5 rounded-lg transition-colors group ${
            onToggleChecklist ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" : ""
          }`}
        >
          <div className="pt-0.5 text-primary">
            {isChecked ? (
              <CheckSquare className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
            ) : (
              <Square className="w-4 h-4 text-muted-fg group-hover:text-primary transition-colors" />
            )}
          </div>
          <span
            className={`text-xs leading-relaxed flex-1 select-text ${
              isChecked ? "line-through text-muted-fg opacity-70" : "text-foreground font-medium"
            }`}
          >
            {renderInlineFormatted(checkText)}
          </span>
        </div>
      );
      continue;
    }

    // Bullet List: - or *
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      renderedElements.push(
        <div key={`bullet-${i}`} style={{ paddingLeft: indentPadding }} className="flex items-start gap-2 py-0.5 text-xs leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
          <span className="flex-1 text-foreground">{renderInlineFormatted(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered List: 1. 2. etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      renderedElements.push(
        <div key={`num-${i}`} style={{ paddingLeft: indentPadding }} className="flex items-start gap-2 py-0.5 text-xs leading-relaxed">
          <span className="font-mono font-bold text-muted-fg text-[11px] w-4 text-right flex-shrink-0">
            {numMatch[1]}.
          </span>
          <span className="flex-1 text-foreground">{renderInlineFormatted(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Horizontal Rule: --- or ***
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      renderedElements.push(
        <hr key={`hr-${i}`} className="my-3 border-none border-t border-black/10 dark:border-white/10" />
      );
      continue;
    }

    // Regular Paragraph
    renderedElements.push(
      <p key={`p-${i}`} className="text-xs leading-relaxed text-foreground/90 my-1">
        {renderInlineFormatted(rawLine)}
      </p>
    );
  }

  // Flush any remaining blocks
  if (inCalloutBlock) flushCallout("end");
  if (inCodeBlock) flushCodeBlock("end");

  return (
    <div
      style={getFontFamilyStyle()}
      className={`prose-sm select-text text-xs leading-relaxed overflow-y-auto ${className}`}
    >
      {renderedElements.length > 0 ? (
        renderedElements
      ) : (
        <p className="text-muted-fg italic text-xs">Empty note...</p>
      )}
    </div>
  );
};
