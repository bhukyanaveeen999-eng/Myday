import { supabase } from './supabase';
import type { Session, User, AuthResponse, AuthChangeEvent } from '@supabase/supabase-js';

function getEmailRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/login`;
}

export const authService = {
  async signUp(email: string, password: string): Promise<AuthResponse['data']> {
    const emailRedirectTo = getEmailRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    if (error) {
      throw error;
    }
    return data;
  },

  async resendConfirmationEmail(email: string): Promise<void> {
    const emailRedirectTo = getEmailRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    if (error) {
      throw error;
    }
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

  async refreshSession(): Promise<{ session: Session | null; expired: boolean }> {
    const { data: current } = await supabase.auth.getSession();
    if (!current.session) {
      return { session: null, expired: false };
    }
    // Refresh if token expires within 2 minutes
    const expiresAt = current.session.expires_at ?? 0;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (expiresAt - nowSeconds > 120) {
      return { session: current.session, expired: false };
    }
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      return { session: null, expired: true };
    }
    return { session: data.session, expired: false };
  },

  async getUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user;
  },

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null, user: User | null) => void
  ) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session, session?.user ?? null);
    });
    return subscription;
  },
};
