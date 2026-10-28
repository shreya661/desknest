import React, { useState } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Mail,
  FileCode,
  FileText,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Note } from "../../types";
import { soundEffects } from "../../services/soundEffectsService";

interface ShareNoteModalProps {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareNoteModal: React.FC<ShareNoteModalProps> = ({
  note,
  isOpen,
  onClose,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const wordCount = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const charCount = note.content.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const markCopied = (type: string) => {
    setCopiedType(type);
    soundEffects.playPop();
    setTimeout(() => {
      setCopiedType(null);
    }, 2200);
  };

  // 1. Copy Formatted Rich Text (HTML + Plain text)
  const handleCopyRichText = async () => {
    try {
      const formattedHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; padding: 16px; border-left: 4px solid #0284c7; background: #f8fafc; color: #0f172a;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">${note.title}</h2>
          <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${note.content}</div>
          <hr style="margin-top: 16px; border: none; border-top: 1px solid #e2e8f0;" />
          <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">Created with DeskNest • ${new Date(note.updatedAt).toLocaleDateString()}</p>
        </div>
      `;
      const plainText = `${note.title}\n\n${note.content}\n\n— DeskNest Note (${new Date(note.updatedAt).toLocaleDateString()})`;

      if (navigator.clipboard && window.ClipboardItem) {
        const textBlob = new Blob([plainText], { type: "text/plain" });
        const htmlBlob = new Blob([formattedHtml], { type: "text/html" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": textBlob,
            "text/html": htmlBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      markCopied("rich");
    } catch {
      await navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
      markCopied("rich");
    }
  };

  // 2. Copy Raw Markdown
  const handleCopyMarkdown = async () => {
    const md = `# ${note.title}\n\n${note.content}\n\n---\n*Created with DeskNest on ${new Date(note.updatedAt).toLocaleDateString()}*`;
    await navigator.clipboard.writeText(md);
    markCopied("markdown");
  };

  // 3. System Web Share API
  const handleSystemShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title,
          text: `${note.title}\n\n${note.content}`,
        });
        soundEffects.playPop();
      } catch (err) {
        // User cancelled or unsupported
        console.log("Share dismissed or failed", err);
      }
    } else {
      handleCopyRichText();
    }
  };

  // 4. Send via Email
  const handleSendEmail = () => {
    const subject = encodeURIComponent(`DeskNest Note: ${note.title}`);
    const body = encodeURIComponent(`${note.title}\n\n${note.content}\n\n---\nCreated with DeskNest`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    soundEffects.playPop();
  };

  // 5. Export as Standalone Styled HTML
  const handleExportHtml = () => {
    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.title || "DeskNest Note"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.65;
      color: #1e293b;
      background: #f8fafc;
      padding: 40px 20px;
      margin: 0;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px 40px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      border: 1px solid #e2e8f0;
    }
    h1 {
      font-size: 26px;
      margin-top: 0;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .content {
      font-size: 15px;
      white-space: pre-wrap;
      color: #334155;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
      font-size: 12px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${note.title}</h1>
    <div class="content">${note.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    <div class="footer">
      <span>DeskNest Productivity Note</span>
      <span>${new Date(note.updatedAt).toLocaleDateString()}</span>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "note"}.html`;
    link.click();
    URL.revokeObjectURL(url);
    soundEffects.playPop();
  };

  // 6. Export as Markdown
  const handleExportMarkdown = () => {
    const md = `# ${note.title}\n\n${note.content}`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "note"}.md`;
    link.click();
    URL.revokeObjectURL(url);
    soundEffects.playPop();
  };

  // 7. Export as Plain Text
  const handleExportText = () => {
    const txt = `${note.title}\n\n${note.content}`;
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "note"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    soundEffects.playPop();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-500">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Share & Export Note</h3>
              <p className="text-[11px] text-muted-fg">Export, copy, or share with any application</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-fg hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Note Preview Strip */}
        <div className="px-5 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
          <div className="flex-1 mr-3">
            <h4 className="font-bold text-xs text-foreground line-clamp-1">{note.title || "Untitled Note"}</h4>
            <div className="flex items-center gap-2 text-[10px] text-muted-fg mt-0.5">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
              <span>•</span>
              <span>~{readingTimeMinutes} min read</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full border border-black/10 dark:border-white/10"
              style={{ backgroundColor: `var(--note-${note.color}-accent)` }}
              title={`Color: ${note.color}`}
            />
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="p-5 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-fg mb-2 block">
              Quick Share & Copy
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyRichText}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
              >
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500 group-hover:scale-105 transition-transform">
                  {copiedType === "rich" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {copiedType === "rich" ? "Copied!" : "Rich Text"}
                  </div>
                  <div className="text-[10px] text-muted-fg">Docs, Word, Slack</div>
                </div>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 group-hover:scale-105 transition-transform">
                  {copiedType === "markdown" ? <Check className="w-4 h-4 text-emerald-500" /> : <FileCode className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {copiedType === "markdown" ? "Copied!" : "Markdown"}
                  </div>
                  <div className="text-[10px] text-muted-fg">GitHub, Obsidian</div>
                </div>
              </button>

              <button
                onClick={handleSendEmail}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">Send Email</div>
                  <div className="text-[10px] text-muted-fg">Outlook, Default Mail</div>
                </div>
              </button>

              {typeof navigator !== "undefined" && "share" in navigator ? (
                <button
                  onClick={handleSystemShare}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
                >
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">System Share</div>
                    <div className="text-[10px] text-muted-fg">Windows Share Hub</div>
                  </div>
                </button>
              ) : (
                <button
                  onClick={handleCopyRichText}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
                >
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">Clipboard</div>
                    <div className="text-[10px] text-muted-fg">Universal Paste</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-fg mb-2 block">
              Download File
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleExportHtml}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-border hover:bg-surface-hover transition-colors text-center"
              >
                <FileCode className="w-4 h-4 text-sky-500 mb-1" />
                <span className="text-xs font-medium text-foreground">HTML</span>
                <span className="text-[9px] text-muted-fg">Standalone web page</span>
              </button>

              <button
                onClick={handleExportMarkdown}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-border hover:bg-surface-hover transition-colors text-center"
              >
                <Download className="w-4 h-4 text-purple-500 mb-1" />
                <span className="text-xs font-medium text-foreground">Markdown</span>
                <span className="text-[9px] text-muted-fg">.md document</span>
              </button>

              <button
                onClick={handleExportText}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-border hover:bg-surface-hover transition-colors text-center"
              >
                <FileText className="w-4 h-4 text-emerald-500 mb-1" />
                <span className="text-xs font-medium text-foreground">Plain Text</span>
                <span className="text-[9px] text-muted-fg">.txt file</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
