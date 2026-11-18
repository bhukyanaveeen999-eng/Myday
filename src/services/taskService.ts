import { supabase } from './supabase';
import type { Database, Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskSummary } from '../types/database.types';

export const TASKS_UPDATED_EVENT = 'myday:tasks-updated';

function emitTasksUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TASKS_UPDATED_EVENT));
  }
}

async function requireCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('You must be signed in to access your tasks.');
  }
  return user.id;
}

export const taskService = {
  async getTasks(statusFilter?: TaskStatus | 'all'): Promise<Task[]> {
    const userId = await requireCurrentUserId();

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return (data as Task[]) || [];
  },

  async getTaskById(id: string): Promise<Task | null> {
    const userId = await requireCurrentUserId();

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data as Task | null;
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    const userId = await requireCurrentUserId();

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title.trim(),
        description: input.description ?? null,
        scheduled_at: input.scheduled_at ?? null,
        timezone: input.timezone || 'Asia/Kolkata',
        priority: input.priority || 'medium',
        status: input.status || 'pending',
        snoozed_until: null,
        reminder_dismissed: false,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    emitTasksUpdated();
    return data as Task;
  },

  async updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
    const userId = await requireCurrentUserId();
    const updatePayload: Database['public']['Tables']['tasks']['Update'] = {};

    if (updates.title !== undefined) updatePayload.title = updates.title.trim();
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.scheduled_at !== undefined) {
      updatePayload.scheduled_at = updates.scheduled_at;
      // Rescheduling a task resets snooze & dismissal so the new reminder triggers cleanly
      if (updates.snoozed_until === undefined) updatePayload.snoozed_until = null;
      if (updates.reminder_dismissed === undefined) updatePayload.reminder_dismissed = false;
    }
    if (updates.timezone !== undefined) updatePayload.timezone = updates.timezone;
    if (updates.priority !== undefined) updatePayload.priority = updates.priority;
    if (updates.status !== undefined) {
      updatePayload.status = updates.status;
      if (updates.status === 'completed' || updates.status === 'cancelled') {
        updatePayload.snoozed_until = null;
        updatePayload.reminder_dismissed = true;
      } else if (updates.status === 'pending' && updates.reminder_dismissed === undefined) {
        updatePayload.reminder_dismissed = false;
      }
    }
    if (updates.snoozed_until !== undefined) updatePayload.snoozed_until = updates.snoozed_until;
    if (updates.last_reminded_at !== undefined) updatePayload.last_reminded_at = updates.last_reminded_at;
    if (updates.reminder_dismissed !== undefined) updatePayload.reminder_dismissed = updates.reminder_dismissed;

    const { data, error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }
    emitTasksUpdated();
    return data as Task;
  },

  async snoozeTaskReminder(id: string, snoozedUntilIso: string): Promise<Task> {
    return this.updateTask(id, {
      snoozed_until: snoozedUntilIso,
      reminder_dismissed: false,
      last_reminded_at: new Date().toISOString(),
    });
  },

  async dismissTaskReminder(id: string): Promise<Task> {
    return this.updateTask(id, {
      snoozed_until: null,
      reminder_dismissed: true,
      last_reminded_at: new Date().toISOString(),
    });
  },

  async deleteTask(id: string): Promise<void> {
    const userId = await requireCurrentUserId();

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
    emitTasksUpdated();
  },

  async toggleTaskStatus(id: string, currentStatus: TaskStatus): Promise<Task> {
    const newStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    return this.updateTask(id, { status: newStatus });
  },

  async getTaskSummary(): Promise<TaskSummary> {
    const userId = await requireCurrentUserId();

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true, nullsFirst: false });

    if (error) {
      throw error;
    }

    const allTasks = (tasks as Task[]) || [];
    const total = allTasks.length;
    const pending = allTasks.filter((t) => t.status === 'pending').length;
    const completed = allTasks.filter((t) => t.status === 'completed').length;

    // Upcoming tasks: pending tasks that have a scheduled date, or upcoming pending tasks
    const nowIso = new Date().toISOString();
    const upcoming = allTasks
      .filter((t) => t.status === 'pending' && t.scheduled_at && t.scheduled_at >= nowIso)
      .slice(0, 5);

    // If less than 5 upcoming scheduled, include other pending tasks
    if (upcoming.length < 5) {
      const otherPending = allTasks
        .filter((t) => t.status === 'pending' && !upcoming.some((u) => u.id === t.id))
        .slice(0, 5 - upcoming.length);
      upcoming.push(...otherPending);
    }

    return {
      total,
      pending,
      completed,
      upcoming,
    };
  },
};
