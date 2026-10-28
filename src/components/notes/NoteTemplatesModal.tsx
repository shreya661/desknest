import React from "react";
import {
  X,
  Users,
  Rocket,
  Lightbulb,
  CheckSquare,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { soundEffects } from "../../services/soundEffectsService";

export interface NoteTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "amber" | "mint" | "sky" | "lavender" | "rose" | "slate";
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "meeting",
    title: "Meeting Notes & Action Items",
    description: "Structure attendees, agenda, discussion points, and follow-ups",
    icon: Users,
    color: "sky",
    content: `# 🤝 Team Sync / Meeting

**Date:** ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
**Attendees:** 
- [ ] Person 1
- [ ] Person 2

---

### 🎯 Objective & Agenda
1. Review sprint goals and milestones
2. Unblock pending architecture decisions
3. Align on release schedule

### 💬 Key Discussion Points
- 

> 📌 **KEY TAKEAWAY**
> Core decision reached during this sync.

### ⚡ Action Items
- [ ] Task 1 — @assignee (Due: )
- [ ] Task 2 — @assignee (Due: )
`,
  },
  {
    id: "project_plan",
    title: "Project & Feature Roadmap",
    description: "Map goals, requirements, technical scope, and milestones",
    icon: Rocket,
    color: "indigo" as unknown as "sky",
    content: `# 🚀 Feature / Project Spec

### 🌟 Overview & Why
What problem are we solving and for whom?

### 🎯 Success Metrics
- 

### 🛠️ Technical Scope
- [ ] Architecture design & data models
- [ ] Frontend UI components & interactions
- [ ] Offline persistence & sync tests

> 💡 **IDEA & INSPIRATION**
> Keep user interactions under 100ms response time.

### ⚠️ Risks & Dependencies
- 
`,
  },
  {
    id: "brainstorm",
    title: "Brainstorming & Idea Canvas",
    description: "Explore problem statements, divergent ideas, and pros/cons",
    icon: Lightbulb,
    color: "amber",
    content: `# 💡 Brainstorming Session

**Focus Area:** 

---

### ❓ The Core Problem
What is the root challenge we want to tackle?

### 🌈 Divergent Ideas (No bad ideas)
1. 
2. 
3. 

### ⚖️ Evaluation & Pros / Cons
- **Idea A:** High impact, moderate effort.
- **Idea B:** Quick win, low complexity.

> 💬 *"The best way to have a good idea is to have lots of ideas."*
> — Linus Pauling

### 🏁 Next Experiment
What is the simplest test we can run this week?
- [ ] 
`,
  },
  {
    id: "daily_standup",
    title: "Daily Standup & Reflection",
    description: "Track yesterday's achievements, today's targets, and blockers",
    icon: CheckSquare,
    color: "mint",
    content: `# 🎯 Daily Focus & Standup

**Date:** ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}

---

### ✅ Completed Yesterday
- 

### 🚀 Today's High-Priority Goals
1. [ ] 
2. [ ] 
3. [ ] 

### 🚧 Current Blockers
- None at the moment!

> 📌 **MOTTO FOR THE DAY**
> Small, consistent progress yields compounding results.
`,
  },
  {
    id: "book_summary",
    title: "Book & Reading Takeaways",
    description: "Summarize chapter insights, quotes, and actionable habits",
    icon: BookOpen,
    color: "lavender",
    content: `# 📖 Book / Reading Summary

**Title:** 
**Author:** 
**Rating:** ⭐⭐⭐⭐⭐

---

### 🧠 The Big Idea (In 1-2 Sentences)
> 

### 🔑 3 Key Principles
1. **Principle 1:** 
2. **Principle 2:** 
3. **Principle 3:** 

### 💬 Memorable Quotes
> 

### ⚡ Actionable Habits to Implement
- [ ] Habit 1: 
- [ ] Habit 2: 
`,
  },
];

interface NoteTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: NoteTemplate) => void;
}

export const NoteTemplatesModal: React.FC<NoteTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Note Templates</h3>
              <p className="text-[11px] text-muted-fg">Start with a structured, beautifully formatted layout</p>
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

        {/* Templates Grid */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto">
          {NOTE_TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                onClick={() => {
                  soundEffects.playPop();
                  onSelectTemplate(tmpl);
                  onClose();
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group relative hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-2 rounded-lg bg-muted text-foreground group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                    {tmpl.title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-fg leading-relaxed">
                  {tmpl.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
