# DeskNest: Your Personal Workspace, Always Within Reach

DeskNest is an offline-first, local-first Windows desktop productivity application designed to stay accessible while coding, browsing, studying, or planning. It combines sticky notes, rich-text note formatting, freehand drawing, key-point capture, daily task tracking with completion progress, scheduled reminders with native Windows notifications, global search, and data backup & restore into one lightweight, customizable desktop widget.

---

## 1. Key Features

### 01. Home Dashboard & Quick Capture
- **Contextual Greeting & Date:** Real-time greeting based on time of day.
- **Quick-Capture Key Points:** Immediate capture box with color tagging for thoughts and action items.
- **Task Summary:** Live completion progress bar (`X of Y done (Z%)`) with quick toggles.
- **Upcoming Reminders:** Immediate visibility into what's due next.
- **Pinned Notes Carousel:** Instant access to your highest-priority sticky notes.

### 02. Sticky Notes System
- **Rich-Text & Markdown Formatting:** Bold, Italic, Strikethrough, Inline Code, Headings (H1/H2), Bullet Lists, Numbered Lists, and Checklists.
- **Color Palettes:** 7 curated themes (Amber, Lemon, Mint, Sky, Lavender, Rose, Slate).
- **Sticky Actions:** Pin to top, duplicate note, copy full content to clipboard, delete with confirmation.
- **Data Safety:** Debounced auto-save with live visual indicator (`Saved` / `Saving...`).
- **Exporting:** Direct export to Markdown (`.md`) or text file.

### 03. Freehand Drawing Board
- **HTML5 Canvas Engine:** High-DPI (`window.devicePixelRatio`) rendering with smooth line interpolation.
- **Tools:** Pen, Eraser, 4 stroke widths (2px, 4px, 8px, 16px), 10 color swatches, and custom HTML5 color picker.
- **History:** Vector-based undo/redo stack (`Ctrl+Z`, `Ctrl+Y`).
- **Persistence & Gallery:** Automatic local saving of drawing vector strokes, thumbnail generation, gallery modal with previews, sketch renaming, and deletion.
- **Export:** Export clean PNG image directly to disk.

### 04. Daily Task Management
- **Task Attributes:** Title, description, priority (`low`, `normal`, `high`), due date & time, category.
- **Views & Filters:** *All*, *Today*, *Upcoming*, *Overdue*, *Completed*.
- **Progress Tracking:** Precise real-time mathematical progress metrics.
- **Editing:** Fast inline creation and rich modal editing.

### 05. Reminders & Native Windows Notifications
- **Scheduling:** Exact date and time scheduling with recurrence options (`none`, `daily`, `weekly`).
- **Native Notifications:** Tauri Windows notification integration (`@tauri-apps/plugin-notification` / Windows WinRT).
- **Sound Alert:** Pleasant, crystal-clear Web Audio synthesized chime (requires zero external audio files).
- **Interactive Controls:** Snooze (+10m, +15m), complete/dismiss, and disable/re-enable.
- **Notification History Log:** Permanent local log of all delivered alerts.

### 06. Global Unified Search
- **Instant Search:** Instant querying across note titles/content, task titles/descriptions, and reminder titles.
- **Categorized Results:** Categorized result cards with direct click-to-open jumping.

### 07. Window Controls & Customization
- **Frameless Window:** Custom TitleBar with intentional drag region (`data-tauri-drag-region`).
- **Multitasking:** Always-on-top toggle (`Pin` icon) to keep DeskNest floating above code editors or browsers.
- **Layouts:** Compact Widget mode (single-column layout) and Expanded Workspace mode (full navigation rail).
- **Themes:** Modern Dark, Clean Light, and System Theme synchronization.

### 08. Local-First Data Architecture & Backup
- **100% Offline:** All data is stored in the user's local application data directory (IndexedDB). Zero external servers, cloud databases, or tracking telemetry.
- **Versioned Backup:** Full export to schema-validated JSON (`desknest-backup-v1.json`).
- **Safe Import:** Pre-import schema validation and preview modal with merge or overwrite options.

---

## 2. Technology Stack

- **Runtime:** Tauri 2.x + Rust (native Windows WebView2, WinRT notifications)
- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Vanilla CSS design tokens + Tailwind CSS
- **Icons:** Lucide React
- **Persistence:** Local client-side IndexedDB engine with repository abstraction
- **Testing:** Vitest + @testing-library/react + fake-indexeddb

---

## 3. Getting Started & Development

### Prerequisites
- **Node.js:** v18+ (tested on Node v24)
- **Rust:** `stable-x86_64-pc-windows-gnu` or `stable-x86_64-pc-windows-msvc`
- **Windows:** Windows 10 or 11 with WebView2 runtime (preinstalled on Windows 11)

### Installation
```bash
# Clone the repository and enter the directory
cd personal_noteback

# Install frontend and dev dependencies
npm install
```

### Running in Development Mode
```bash
# Starts Vite dev server and launches native Tauri desktop window
npm run tauri dev
```

### Running Automated Tests
```bash
# Run unit and integration tests via Vitest
npm test

# Run TypeScript type verification
npm run lint
```

### Building for Production
```bash
# Build frontend production bundle and native Windows desktop installer/executable
npm run tauri build
```

---

## 4. Test Verification Summary

19 automated tests covering core functionality:
- `tests/notes.test.ts`: 5 passing tests (CRUD, debounced updates, pinned sorting, search, deletion)
- `tests/tasks.test.ts`: 5 passing tests (creation, toggle status, mathematical progress calculation, empty list handling, priority sorting)
- `tests/reminders.test.ts`: 4 passing tests (scheduling, snooze calculation, daily recurrence advancement, one-time disabling)
- `tests/backup.test.ts`: 5 passing tests (versioned export, valid schema check, syntax error rejection, header validation, merge import)

---

## 5. Security & Privacy Guarantees

1. **Zero External Calls:** DeskNest does not make any network requests during normal operation.
2. **No Registration or Accounts:** Ready to use immediately upon opening.
3. **No Telemetry or Tracking:** Your private notes, sketches, and tasks never leave your computer.
4. **Local Data Persistence:** Stored safely in local application storage with versioned JSON backup options.

---

## 6. Known Limitations

- **Reminders When App Is Terminated:** Reminders trigger while the application is running (or minimized). If the application is fully closed by the user, missed reminders are detected and queued when the application is reopened.
- **Windows Focus:** In certain multi-monitor Windows setups, frameless window snapping depends on Windows 11 Snap Layouts shortcuts (`Win + Arrow keys`).
