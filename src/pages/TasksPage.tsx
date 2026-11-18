import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { taskService } from '../services/taskService';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskPriority, TaskStatus } from '../types/database.types';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { DatePicker } from '../components/DatePicker';
import { TimePicker } from '../components/TimePicker';
import { formatDateTime, toInputDate, toInputTime, combineDateAndTime } from '../utils/dateUtils';
import { computeSnoozeUntilIso } from '../utils/reminderScheduler';
import { Plus, CheckSquare, Clock, AlertCircle, Trash2, Edit2, Loader2, X } from 'lucide-react';

function parseStatusParam(param: string | null): TaskStatus | 'all' {
  if (param === 'pending' || param === 'completed' || param === 'all') {
    return param;
  }
  return 'all';
}

export const TasksPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusFilter = parseStatusParam(searchParams.get('status'));
  const highlightedReminderId = searchParams.get('reminder');
  const reminderAction = searchParams.get('action');

  const handleFilterChange = (filter: TaskStatus | 'all') => {
    setSearchParams(filter === 'all' ? {} : { status: filter }, { replace: true });
  };

  // Handle notification click actions (?reminder=<id>&action=snooze|dismiss)
  useEffect(() => {
    if (!highlightedReminderId || !reminderAction) return;
    const run = async () => {
      try {
        if (reminderAction === 'snooze') {
          await taskService.snoozeTaskReminder(highlightedReminderId, computeSnoozeUntilIso());
        } else if (reminderAction === 'dismiss') {
          await taskService.dismissTaskReminder(highlightedReminderId);
        }
      } catch {
        // Ignore if task no longer exists
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete('action');
        setSearchParams(next, { replace: true });
      }
    };
    void run();
  }, [highlightedReminderId, reminderAction, searchParams, setSearchParams]);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await taskService.getTasks(statusFilter);
      setTasks(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tasks.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setScheduledDate('');
    setScheduledTime('');
    setPriority('medium');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setScheduledDate(toInputDate(task.scheduled_at));
    setScheduledTime(toInputTime(task.scheduled_at));
    setPriority(task.priority);
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setIsFormOpen(false);
    setEditingTask(null);
    setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Task title is required.');
      return;
    }

    let effectiveDate = scheduledDate;
    if (!effectiveDate && scheduledTime) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      effectiveDate = `${yyyy}-${mm}-${dd}`;
    }

    const scheduledIso = effectiveDate ? combineDateAndTime(effectiveDate, scheduledTime) : null;

    try {
      setIsSubmitting(true);
      if (editingTask) {
        const updates: UpdateTaskInput = {
          title: title.trim(),
          description: description.trim() || null,
          scheduled_at: scheduledIso,
          priority,
        };
        await taskService.updateTask(editingTask.id, updates);
      } else {
        const input: CreateTaskInput = {
          title: title.trim(),
          description: description.trim() || null,
          scheduled_at: scheduledIso,
          priority,
          status: 'pending',
          timezone: 'Asia/Kolkata',
        };
        await taskService.createTask(input);
      }

      closeFormModal();
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save task.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    try {
      await taskService.toggleTaskStatus(task.id, task.status);
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update task status.';
      setError(msg);
    }
  };

  const confirmDelete = async () => {
    if (!deletingTask) return;
    try {
      setIsDeleting(true);
      await taskService.deleteTask(deletingTask.id);
      setDeletingTask(null);
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task.';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-sm text-gray-500">Create, organize, schedule and complete your daily tasks.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Task
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchTasks}
            className="text-xs underline hover:no-underline font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 space-x-4">
        {(['all', 'pending', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => handleFilterChange(filter)}
            className={`pb-2.5 px-1 text-sm font-medium capitalize border-b-2 transition-colors ${
              statusFilter === filter
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {filter} {statusFilter === filter ? `(${tasks.length})` : ''}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckSquare className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-700">No tasks found</p>
            <p className="text-xs text-gray-400 mt-1">
              {statusFilter === 'all'
                ? 'Start by creating your first task.'
                : `No tasks match the filter "${statusFilter}".`}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Task
            </button>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                highlightedReminderId === task.id
                  ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-300'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Checkbox and Content */}
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  onChange={() => handleToggleStatus(task)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                  aria-label={`Mark task ${task.title} as ${task.status === 'completed' ? 'pending' : 'completed'}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {task.scheduled_at && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatDateTime(task.scheduled_at)}
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border capitalize font-medium ${getPriorityBadgeClass(
                        task.priority
                      )}`}
                    >
                      {task.priority} priority
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border capitalize font-medium ${
                        task.status === 'completed'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : task.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-600 border-gray-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => openEditModal(task)}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit Task"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingTask(task)}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Task Create / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </h2>
              <button
                type="button"
                onClick={closeFormModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Prepare project presentation"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-2xs text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add additional details or links..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-2xs text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Scheduled Date
                  </label>
                  <DatePicker value={scheduledDate} onChange={setScheduledDate} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Scheduled Time
                  </label>
                  <TimePicker value={scheduledTime} onChange={setScheduledTime} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-2xs text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deletingTask)}
        title="Delete Task"
        message={`Are you sure you want to delete "${deletingTask?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTask(null)}
      />
    </div>
  );
};

