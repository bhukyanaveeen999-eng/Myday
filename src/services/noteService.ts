import { supabase } from './supabase';
import type { Database, Note, CreateNoteInput, UpdateNoteInput } from '../types/database.types';

async function requireCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('You must be signed in to access your notes.');
  }
  return user.id;
}

export const noteService = {
  async getNotes(): Promise<Note[]> {
    const userId = await requireCurrentUserId();

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }
    return (data as Note[]) || [];
  },

  async getNoteById(id: string): Promise<Note | null> {
    const userId = await requireCurrentUserId();

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data as Note | null;
  },

  async createNote(input: CreateNoteInput): Promise<Note> {
    const userId = await requireCurrentUserId();

    const { data, error } = await supabase
      .from('notes')
      .insert({
        title: input.title ? input.title.trim() : 'Untitled Note',
        content: input.content ?? '',
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as Note;
  },

  async updateNote(id: string, updates: UpdateNoteInput): Promise<Note> {
    const userId = await requireCurrentUserId();
    const updatePayload: Database['public']['Tables']['notes']['Update'] = {};

    if (updates.title !== undefined) updatePayload.title = updates.title.trim();
    if (updates.content !== undefined) updatePayload.content = updates.content;

    const { data, error } = await supabase
      .from('notes')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as Note;
  },

  async deleteNote(id: string): Promise<void> {
    const userId = await requireCurrentUserId();

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  },
};
