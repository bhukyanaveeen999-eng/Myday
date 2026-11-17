import { supabase } from './supabase';
import type { Database, Note, CreateNoteInput, UpdateNoteInput } from '../types/database.types';

export const noteService = {
  async getNotes(): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }
    return (data as Note[]) || [];
  },

  async getNoteById(id: string): Promise<Note | null> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data as Note | null;
  },

  async createNote(input: CreateNoteInput): Promise<Note> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be logged in to create a note.');
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        title: input.title ? input.title.trim() : 'Untitled Note',
        content: input.content ?? '',
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as Note;
  },

  async updateNote(id: string, updates: UpdateNoteInput): Promise<Note> {
    const updatePayload: Database['public']['Tables']['notes']['Update'] = {};

    if (updates.title !== undefined) updatePayload.title = updates.title.trim();
    if (updates.content !== undefined) updatePayload.content = updates.content;

    const { data, error } = await supabase
      .from('notes')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as Note;
  },

  async deleteNote(id: string): Promise<void> {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  },
};
