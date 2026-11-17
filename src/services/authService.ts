import { supabase } from './supabase';
import type { Session, User, AuthResponse } from '@supabase/supabase-js';

export const authService = {
  async signUp(email: string, password: string): Promise<AuthResponse['data']> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      throw error;
    }
    return data;
  },

  async signIn(email: string, password: string): Promise<AuthResponse['data']> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }
    return data;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  },

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[authService.getSession]', error.message);
      return null;
    }
    return data.session;
  },

  async getUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user;
  },

  onAuthStateChange(callback: (session: Session | null, user: User | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session, session?.user ?? null);
    });
    return subscription;
  },
};
