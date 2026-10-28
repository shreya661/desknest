import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  Trash2,
  Calendar,
  AlertCircle,
  Edit3,
} from "lucide-react";
import { Task, TaskPriority } from "../../types";
import { tasksRepository } from "../../repositories/tasksRepository";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import { soundEffects } from "../../services/soundEffectsService";
import { triggerConfetti } from "../../utils/confetti";

interface TasksWorkspaceProps {
  tasks: Task[];
  onRefreshTasks: () => void;
}

type FilterTab = "today" | "upcoming" | "overdue" | "completed" | "all";

export const TasksWorkspace: React.FC<TasksWorkspaceProps> = ({
  tasks,
  onRefreshTasks,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [newCategory, setNewCategory] = useState("Work");

  // Edit Task Modal State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("normal");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const progress = tasksRepository.calculateProgress(tasks);
  const now = new Date();

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await tasksRepository.create({
      title: newTitle.trim(),
      priority: newPriority,
      dueAt: newDueDate ? new Date(newDueDate).toISOString() : null,
      category: newCategory.trim() || "General",
    });

    setNewTitle("");
    setNewDueDate("");
    onRefreshTasks();
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    const wasPending = task?.status === "pending";
    await tasksRepository.toggleComplete(id);
    if (wasPending) {
      soundEffects.playTaskComplete();
      triggerConfetti();
    }
    onRefreshTasks();
  };

  const handleDeleteTask = async (id: string) => {
    if (window.confirm("Delete this task?")) {
      await tasksRepository.delete(id);
      onRefreshTasks();
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditPriority(task.priority);
    setEditDueDate(task.dueAt ? task.dueAt.substring(0, 16) : "");
    setEditCategory(task.category);
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !editTitle.trim()) return;

    await tasksRepository.update(editingTask.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      dueAt: editDueDate ? new Date(editDueDate).toISOString() : null,
      category: editCategory.trim() || "General",
    });

    setEditingTask(null);
    onRefreshTasks();
  };

  // Filter tasks according to activeTab
  const filteredTasks = tasks.filter((task) => {
    if (activeTab === "completed") return task.status === "completed";
    if (activeTab === "all") return true;

    // For other tabs, focus on pending tasks
    if (task.status === "completed") return false;

    if (activeTab === "today") {
      if (!task.dueAt) return true; // Undated tasks show up in today
      const due = new Date(task.dueAt);
      return (
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate()
      );
    }

    if (activeTab === "upcoming") {
      if (!task.dueAt) return false;
      const due = new Date(task.dueAt);
      return due > now;
    }

    if (activeTab === "overdue") {
      if (!task.dueAt) return false;
      const due = new Date(task.dueAt);
      return due < now;
    }

    return true;
  });

  const isOverdue = (task: Task) => {
    if (!task.dueAt || task.status === "completed") return false;
    return new Date(task.dueAt) < now;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-3">
      {/* Header & Progress Card */}
      <div className="bg-surface rounded-xl p-3 border border-border shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h1 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Task Dashboard
            </h1>
          </div>
          <span className="text-xs font-semibold text-foreground">
            {progress.completed} of {progress.total} done ({progress.percentage}%)
          </span>
        </div>

        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Quick Add Form */}
      <form
        onSubmit={handleCreateTask}
        className="bg-surface rounded-xl p-3 border border-border shadow-xs space-y-2 select-none"
      >
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground placeholder:text-muted-fg focus:outline-none focus:border-primary"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!newTitle.trim()}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Priority selector */}
          <div className="flex items-center gap-1 bg-surface-elevated px-2 py-1 rounded-md border border-border">
            <span className="text-[10px] text-muted-fg mr-1 font-medium">Priority:</span>
            {(["low", "normal", "high"] as TaskPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNewPriority(p)}
                className={`px-1.5 py-0.5 rounded text-[10px] capitalize font-medium transition-colors ${
                  newPriority === p
                    ? p === "high"
                      ? "bg-rose-500 text-white"
                      : p === "normal"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-500 text-white"
                    : "text-muted-fg hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Due date input */}
          <div className="flex items-center gap-1 bg-surface-elevated px-2 py-1 rounded-md border border-border">
            <Clock className="w-3 h-3 text-muted-fg" />
            <input
              type="datetime-local"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="bg-transparent text-[11px] text-foreground focus:outline-none"
            />
          </div>

          {/* Category */}
          <div className="flex items-center gap-1 bg-surface-elevated px-2 py-1 rounded-md border border-border">
            <span className="text-[10px] text-muted-fg">Category:</span>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Tag..."
              className="w-16 bg-transparent text-[11px] text-foreground focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-1 text-xs select-none overflow-x-auto">
        {(["all", "today", "upcoming", "overdue", "completed"] as FilterTab[]).map(
          (tab) => {
            const count =
              tab === "all"
                ? tasks.length
                : tab === "completed"
                ? progress.completed
                : tab === "today"
                ? tasks.filter((t) => t.status === "pending").length
                : tab === "overdue"
                ? tasks.filter((t) => isOverdue(t)).length
                : tasks.filter((t) => t.status === "pending" && t.dueAt && new Date(t.dueAt) > now).length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-fg hover:text-foreground hover:bg-surface"
                }`}
              >
                <span>{tab}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === tab ? "bg-white/20" : "bg-muted"}`}>
                  {count}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {filteredTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-fg">
            <CheckCircle2 className="w-8 h-8 opacity-40 mb-2" />
            <p className="text-xs font-semibold text-foreground">No tasks in this view</p>
            <p className="text-[11px] mt-1">
              {activeTab === "completed"
                ? "Completed tasks will show up here."
                : "Add a new task above to stay on track."}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <div
                key={task.id}
                className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 group ${
                  task.status === "completed"
                    ? "bg-surface/50 border-border opacity-60"
                    : overdue
                    ? "bg-rose-500/5 border-rose-500/30"
                    : "bg-surface border-border hover:border-primary/50"
                }`}
              >
                {/* Complete Checkbox */}
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="mt-0.5 text-muted-fg hover:text-primary transition-colors"
                  aria-label={task.status === "completed" ? "Reopen task" : "Complete task"}
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs font-semibold ${
                        task.status === "completed"
                          ? "line-through text-muted-fg"
                          : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </span>

                    {/* Priority badge */}
                    {task.priority === "high" && (
                      <Badge variant="danger" className="text-[9px] py-0">High</Badge>
                    )}
                    {task.priority === "low" && (
                      <Badge variant="default" className="text-[9px] py-0">Low</Badge>
                    )}

                    {/* Category */}
                    {task.category && (
                      <span className="text-[10px] text-muted-fg bg-surface-elevated px-1.5 py-0.2 rounded border border-border">
                        {task.category}
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-[11px] text-muted-fg mt-0.5 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {/* Due date info */}
                  {task.dueAt && (
                    <div
                      className={`flex items-center gap-1 text-[10px] mt-1 font-medium ${
                        overdue ? "text-rose-500" : "text-muted-fg"
                      }`}
                    >
                      {overdue ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Calendar className="w-3 h-3" />
                      )}
                      <span>
                        Due: {new Date(task.dueAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-1 rounded text-muted-fg hover:text-foreground hover:bg-surface-elevated"
                    title="Edit task"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 rounded text-muted-fg hover:text-rose-500 hover:bg-rose-500/10"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Task Modal */}
      <Modal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Edit Task"
        maxWidth="md"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Description (Optional)
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Priority
              </label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Category
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Due Date & Time
            </label>
            <input
              type="datetime-local"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setEditingTask(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
