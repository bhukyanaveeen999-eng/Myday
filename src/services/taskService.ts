import { supabase } from './supabase';
import type { Database, Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskSummary } from '../types/database.types';

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
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as Task;
  },

  async updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
    const userId = await requireCurrentUserId();
    const updatePayload: Database['public']['Tables']['tasks']['Update'] = {};

    if (updates.title !== undefined) updatePayload.title = updates.title.trim();
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.scheduled_at !== undefined) updatePayload.scheduled_at = updates.scheduled_at;
    if (updates.timezone !== undefined) updatePayload.timezone = updates.timezone;
    if (updates.priority !== undefined) updatePayload.priority = updates.priority;
    if (updates.status !== undefined) updatePayload.status = updates.status;

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
    return data as Task;
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
