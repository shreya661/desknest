import React, { useState } from "react";
import { Search, FileText, CheckSquare, Bell, ArrowRight } from "lucide-react";
import { Note, Task, Reminder, WorkspaceType } from "../../types";
import { Badge } from "../common/Badge";

interface SearchWorkspaceProps {
  notes: Note[];
  tasks: Task[];
  reminders: Reminder[];
  onOpenNote: (id: string) => void;
  onOpenWorkspace: (ws: WorkspaceType) => void;
}

export const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
  notes,
  tasks,
  reminders,
  onOpenNote,
  onOpenWorkspace,
}) => {
  const [query, setQuery] = useState("");

  const lowerQuery = query.toLowerCase().trim();

  const matchingNotes = lowerQuery
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(lowerQuery) ||
          n.content.toLowerCase().includes(lowerQuery)
      )
    : [];

  const matchingTasks = lowerQuery
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(lowerQuery) ||
          t.description.toLowerCase().includes(lowerQuery)
      )
    : [];

  const matchingReminders = lowerQuery
    ? reminders.filter(
        (r) =>
          r.title.toLowerCase().includes(lowerQuery) ||
          r.description.toLowerCase().includes(lowerQuery)
      )
    : [];

  const totalMatches =
    matchingNotes.length + matchingTasks.length + matchingReminders.length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-3">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted-fg absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          autoFocus
          placeholder="Search all notes, tasks, and reminders..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-surface border border-border text-foreground placeholder:text-muted-fg focus:outline-none focus:border-primary shadow-xs"
        />
      </div>

      {/* Results Header */}
      {lowerQuery && (
        <div className="flex items-center justify-between text-xs text-muted-fg px-1">
          <span>
            {totalMatches} {totalMatches === 1 ? "result" : "results"} found
          </span>
        </div>
      )}

      {/* Results List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {!lowerQuery ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-fg">
            <Search className="w-10 h-10 opacity-30 mb-2" />
            <p className="text-xs font-semibold text-foreground">Global Search</p>
            <p className="text-[11px] mt-1 max-w-xs">
              Type keywords to instantly search across all your sticky notes, tasks, and scheduled reminders.
            </p>
          </div>
        ) : totalMatches === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-fg">
            <p className="text-xs font-semibold text-foreground">No matches found for "{query}"</p>
            <p className="text-[11px] mt-1">
              Check for typos or try searching with broader keywords.
            </p>
          </div>
        ) : (
          <>
            {/* Notes Section */}
            {matchingNotes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-fg uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Notes ({matchingNotes.length})
                </span>
                <div className="space-y-1.5">
                  {matchingNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => onOpenNote(note.id)}
                      className="p-2.5 rounded-xl border border-border bg-surface hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="truncate flex-1 mr-2">
                        <h4 className="text-xs font-semibold text-foreground truncate">
                          {note.title}
                        </h4>
                        <p className="text-[11px] text-muted-fg truncate mt-0.5">
                          {note.content || "Empty note"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant="default" className="text-[10px] capitalize">
                          {note.color}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-fg group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks Section */}
            {matchingTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-fg uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  Tasks ({matchingTasks.length})
                </span>
                <div className="space-y-1.5">
                  {matchingTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onOpenWorkspace("tasks")}
                      className="p-2.5 rounded-xl border border-border bg-surface hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="truncate flex-1 mr-2">
                        <h4 className="text-xs font-semibold text-foreground truncate">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-[11px] text-muted-fg truncate mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge
                          variant={task.status === "completed" ? "success" : "default"}
                          className="text-[10px]"
                        >
                          {task.status}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-fg group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders Section */}
            {matchingReminders.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-fg uppercase tracking-wider flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-sky-500" />
                  Reminders ({matchingReminders.length})
                </span>
                <div className="space-y-1.5">
                  {matchingReminders.map((rem) => (
                    <div
                      key={rem.id}
                      onClick={() => onOpenWorkspace("reminders")}
                      className="p-2.5 rounded-xl border border-border bg-surface hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="truncate flex-1 mr-2">
                        <h4 className="text-xs font-semibold text-foreground truncate">
                          {rem.title}
                        </h4>
                        {rem.description && (
                          <p className="text-[11px] text-muted-fg truncate mt-0.5">
                            {rem.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-muted-fg">
                          {new Date(rem.scheduledAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-fg group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
