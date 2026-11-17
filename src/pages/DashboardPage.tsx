import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { taskService } from '../services/taskService';
import type { Task, TaskSummary } from '../types/database.types';
import { formatDateTime } from '../utils/dateUtils';
import { CheckSquare, Clock, CheckCircle2, ListTodo, Plus, Calendar, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<TaskSummary>({
    total: 0,
    pending: 0,
    completed: 0,
    upcoming: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await taskService.getTaskSummary();
      setSummary(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleToggleTask = async (task: Task) => {
    try {
      setUpdatingTaskId(task.id);
      await taskService.toggleTaskStatus(task.id, task.status);
      await fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update task status.';
      setError(msg);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const getPriorityBadgeClass = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of your daily tasks and schedule.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/tasks"
            className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Task
          </Link>
          <Link
            to="/notes"
            className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Note
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Error loading dashboard</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchSummary}
            className="text-xs underline hover:no-underline font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Tasks */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tasks</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {loading ? '-' : summary.total}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ListTodo className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Pending</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {loading ? '-' : summary.pending}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-green-600 uppercase tracking-wider">Completed</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {loading ? '-' : summary.completed}
            </p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Upcoming Scheduled Tasks */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Upcoming & Pending Tasks</h2>
          </div>
          <Link
            to="/tasks"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <p className="text-sm">Loading tasks...</p>
            </div>
          ) : summary.upcoming.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckSquare className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">No pending tasks!</p>
              <p className="text-xs text-gray-400 mt-1">You are all caught up for today.</p>
              <Link
                to="/tasks"
                className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
              >
                Create your first task
              </Link>
            </div>
          ) : (
            summary.upcoming.map((task) => (
              <div
                key={task.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    disabled={updatingTaskId === task.id}
                    onChange={() => handleToggleTask(task)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.scheduled_at && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatDateTime(task.scheduled_at)}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border capitalize font-medium ${getPriorityBadgeClass(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to="/tasks"
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                >
                  Manage
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
