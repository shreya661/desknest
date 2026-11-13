import React from "react";
import { BlockPluginProps, DeskNestBlockPlugin } from "../blockRegistry";
import { Sparkles, Lightbulb, Quote, AlertTriangle, Trash2 } from "lucide-react";
import { useBlockEngineContext } from "../BlockEngineContext";

export type CalloutVariant = "keypoint" | "idea" | "quote" | "warning";

export interface CalloutBlockData {
  text: string;
  variant: CalloutVariant;
}

const CalloutBlockComponent: React.FC<BlockPluginProps<CalloutBlockData>> = ({
  data,
  onChange,
  onDelete,
  onFocus,
}) => {
  const { isReadOnly = false } = useBlockEngineContext();

  const text = data?.text || "";
  const variant: CalloutVariant = data?.variant || "idea";

  const getVariantStyles = () => {
    switch (variant) {
      case "keypoint":
        return {
          icon: <Sparkles className="w-4 h-4 text-amber-500" />,
          title: "KEY TAKEAWAY",
          classes:
            "border-amber-400/80 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        };
      case "idea":
        return {
          icon: <Lightbulb className="w-4 h-4 text-sky-500" />,
          title: "IDEA & INSIGHT",
          classes:
            "border-sky-400/80 bg-sky-500/10 text-sky-950 dark:text-sky-100",
        };
      case "quote":
        return {
          icon: <Quote className="w-4 h-4 text-purple-500" />,
          title: "QUOTE",
          classes:
            "border-purple-400/80 bg-purple-500/10 text-purple-950 dark:text-purple-100",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
          title: "IMPORTANT NOTE",
          classes:
            "border-rose-400/80 bg-rose-500/10 text-rose-950 dark:text-rose-100",
        };
    }
  };

  const currentVariant = getVariantStyles();

  return (
    <div
      className={`w-full my-2 rounded-xl border-l-4 p-3 ${currentVariant.classes} relative group/callout transition-all select-none`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {currentVariant.icon}
          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
            {currentVariant.title}
          </span>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover/callout:opacity-100 transition-opacity">
            <select
              value={variant}
              onChange={(e) =>
                onChange({ ...data, variant: e.target.value as CalloutVariant })
              }
              className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5 text-[10px] font-semibold text-foreground cursor-pointer focus:outline-none"
            >
              <option value="keypoint">Keypoint</option>
              <option value="idea">Idea</option>
              <option value="quote">Quote</option>
              <option value="warning">Alert</option>
            </select>

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Delete card"
                className="p-1 rounded text-muted-fg hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <textarea
        value={text}
        disabled={isReadOnly}
        onFocus={onFocus}
        onChange={(e) => onChange({ ...data, text: e.target.value })}
        placeholder="Enter note or observation..."
        rows={Math.max(2, text.split("\n").length)}
        className="w-full bg-transparent text-xs font-medium leading-relaxed resize-none focus:outline-none placeholder:text-muted-fg/60 select-text"
      />
    </div>
  );
};

export const calloutBlockPlugin: DeskNestBlockPlugin<CalloutBlockData> = {
  type: "callout",
  label: "Callout Card",
  description: "Aesthetic callout card for notes, ideas, or alerts",
  shortcut: "/callout",
  defaultData: () => ({ text: "", variant: "idea" }),
  toPlainText: (data) =>
    `> 📌 **${(data?.variant || "NOTE").toUpperCase()}**\n> ${data?.text || ""}`,
  renderBlock: (props) => <CalloutBlockComponent {...props} />,
};

