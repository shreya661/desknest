export type WorkspaceType =
  | "home"
  | "notes"
  | "drawing"
  | "tasks"
  | "reminders"
  | "search"
  | "settings";

export type NoteColor =
  | "amber"
  | "lemon"
  | "mint"
  | "sky"
  | "lavender"
  | "rose"
  | "slate";

export interface VoiceRecording {
  id: string;
  audioData: string; // Base64 Data URL (audio/webm or audio/wav)
  durationSeconds: number;
  createdAt: string;
  transcription?: string;
}

export type NoteFontStyle = "sans" | "serif" | "mono" | "casual";

export interface TextBlock {
  id: string;
  type: "text";
  content: string;
}

export interface DrawingBlock {
  id: string;
  type: "drawing";
  drawingId: string;
  title?: string;
  displayMode?: "inline" | "expanded";
  aspectRatio?: number;
}

export type NoteBlock = TextBlock | DrawingBlock;

export interface NoteDraftRecord {
  id: string;
  noteId: string;
  title: string;
  blocks: NoteBlock[];
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  fontStyle?: NoteFontStyle;
  voiceRecordings?: VoiceRecording[];
  schemaVersion?: number;
  blocks?: NoteBlock[];
  linkedDrawingIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = "low" | "normal" | "high";
export type TaskStatus = "pending" | "completed";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type ReminderRecurrence = "none" | "daily" | "weekly";

export interface Reminder {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  recurrence: ReminderRecurrence;
  enabled: boolean;
  completedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export type DrawingTool =
  | "select"
  | "pen"
  | "eraser"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "text";


export interface DrawingStroke {
  id: string;
  tool: DrawingTool;
  color: string;
  width: number;
  points: DrawingPoint[];
  text?: string;
  fontSize?: number;
}

export interface Drawing {
  id: string;
  title: string;
  documentVersion: number;
  strokes: DrawingStroke[];
  thumbnail: string | null; // data URL
  width: number;
  height: number;
  isEmbedded?: boolean;
  parentNoteId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSettings {
  theme: "light" | "dark" | "system";
  alwaysOnTop: boolean;
  compactMode: boolean;
  defaultWidth: number;
  defaultHeight: number;
  defaultNoteColor: NoteColor;
  notificationSound: boolean;
  textSize: "compact" | "normal" | "large";
}

export interface NotificationRecord {
  id: string;
  reminderId: string;
  title: string;
  description: string;
  triggeredAt: string;
  status: "delivered" | "snoozed" | "dismissed";
}

export interface BackupData {
  format: "desknest-backup";
  version: 1 | 2;
  exportedAt: string;
  notes: Note[];
  tasks: Task[];
  reminders: Reminder[];
  drawings: Drawing[];
  settings: ApplicationSettings;
  notifications: NotificationRecord[];
}

