import React, { useState } from "react";
import { Plus, Search, Pin, FileText, FileSpreadsheet, PenTool } from "lucide-react";
import { Note, NoteColor } from "../../types";
import { notesRepository } from "../../repositories/notesRepository";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";
import { Button } from "../common/Button";
import { NoteTemplatesModal, NoteTemplate } from "./NoteTemplatesModal";

interface NotesWorkspaceProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (id: string | null) => void;
  onRefreshNotes: () => void;
  defaultNoteColor?: NoteColor;
  onOpenFullCanvas?: (drawingId: string) => void;
}

export const NotesWorkspace: React.FC<NotesWorkspaceProps> = ({
  notes,
  selectedNoteId,
  onSelectNote,
  onRefreshNotes,
  defaultNoteColor = "amber",
  onOpenFullCanvas,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterColor, setFilterColor] = useState<NoteColor | "all">("all");
  const [filterPinned, setFilterPinned] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);

  const activeNote = notes.find((n) => n.id === selectedNoteId);

  const handleCreateNote = async () => {
    const created = await notesRepository.create({
      title: "Untitled Note",
      content: "",
      color: filterColor !== "all" ? filterColor : defaultNoteColor,
      isPinned: false,
    });
    onRefreshNotes();
    onSelectNote(created.id);
  };

  const handleCreateSketch = async () => {
    const { note } = await notesRepository.createSketchNotebook({
      title: "Untitled Sketch",
      color: filterColor !== "all" ? filterColor : "sky",
    });
    onRefreshNotes();
    onSelectNote(note.id);
  };

  const handleApplyTemplate = async (tmpl: NoteTemplate) => {
    const created = await notesRepository.create({
      title: tmpl.title,
      content: tmpl.content,
      color: tmpl.color,
      isPinned: false,
    });
    onRefreshNotes();
    onSelectNote(created.id);
  };

  const handleUpdateNote = (_updated: Note) => {
    onRefreshNotes();
  };

  const handleDeleteNote = async (id: string) => {
    await notesRepository.delete(id);
    if (selectedNoteId === id) {
      onSelectNote(null);
    }
    onRefreshNotes();
  };

  const handleDuplicateNote = async (source: Note) => {
    const duplicated = await notesRepository.create({
      title: `${source.title} (Copy)`,
      content: source.content,
      color: source.color,
      isPinned: source.isPinned,
    });
    onRefreshNotes();
    onSelectNote(duplicated.id);
  };

  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    await notesRepository.update(note.id, { isPinned: !note.isPinned });
    onRefreshNotes();
  };

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      !searchQuery.trim() ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesColor = filterColor === "all" || n.color === filterColor;
    const matchesPinned = !filterPinned || n.isPinned;

    return matchesSearch && matchesColor && matchesPinned;
  });

  const colors: { id: NoteColor | "all"; label: string; bg: string }[] = [
    { id: "all", label: "All", bg: "bg-muted" },
    { id: "amber", label: "Amber", bg: "bg-amber-400" },
    { id: "lemon", label: "Lemon", bg: "bg-yellow-300" },
    { id: "mint", label: "Mint", bg: "bg-emerald-400" },
    { id: "sky", label: "Sky", bg: "bg-sky-400" },
    { id: "lavender", label: "Lavender", bg: "bg-purple-400" },
    { id: "rose", label: "Rose", bg: "bg-rose-400" },
    { id: "slate", label: "Slate", bg: "bg-slate-400" },
  ];

  // If a note is currently open in editor
  if (activeNote) {
    return (
      <div className="flex-1 flex flex-col h-full p-3 overflow-hidden">
        <NoteEditor
          note={activeNote}
          onClose={() => onSelectNote(null)}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
          onDuplicate={handleDuplicateNote}
          onOpenFullCanvas={onOpenFullCanvas}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-3">
      {/* Top action row */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-muted-fg absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted-fg focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setTemplatesModalOpen(true)}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Template</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCreateSketch}
            title="Create visual sketch notebook"
            className="border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
          >
            <PenTool className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">Sketch</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreateNote}>
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </Button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterPinned(!filterPinned)}
          className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors text-[11px] ${
            filterPinned
              ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold"
              : "border-border text-muted-fg hover:text-foreground"
          }`}
        >
          <Pin className="w-3 h-3" />
          <span>Pinned</span>
        </button>

        <div className="w-[1px] h-3.5 bg-border mx-1" />

        {colors.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterColor(c.id)}
            className={`px-2 py-0.5 rounded-md border text-[11px] flex items-center gap-1 transition-colors ${
              filterColor === c.id
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "border-border text-muted-fg hover:text-foreground hover:bg-surface-elevated"
            }`}
          >
            {c.id !== "all" && <span className={`w-2 h-2 rounded-full ${c.bg}`} />}
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Notes Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-fg">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-muted-fg opacity-60" />
            </div>
            <p className="text-xs font-semibold text-foreground">No notes found</p>
            <p className="text-[11px] mt-1 max-w-[200px]">
              {searchQuery || filterColor !== "all" || filterPinned
                ? "Try adjusting your search query or filters"
                : "Create your first sticky note to capture your thoughts."}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCreateNote}
              className="mt-4"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Note</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => onSelectNote(note.id)}
                onTogglePin={(e) => handleTogglePin(e, note)}
                onDelete={(e) => {
                  e.stopPropagation();
                  if (window.confirm("Delete this note?")) {
                    handleDeleteNote(note.id);
                  }
                }}
                onDuplicate={(e) => {
                  e.stopPropagation();
                  handleDuplicateNote(note);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Note Templates Modal */}
      <NoteTemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />
    </div>
  );
};
