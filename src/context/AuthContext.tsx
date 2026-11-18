import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authService } from '../services/authService';

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
  alreadyRegistered: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  const manualSignOutRef = useRef<boolean>(false);
  const hadActiveSessionRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    // Restore persisted session on app / PWA launch
    authService.getSession().then(async (initialSession) => {
      if (!isMounted) return;
      if (initialSession) {
        // Ensure token is fresh if device was asleep or offline
        const { session: freshSession, expired } = await authService.refreshSession();
        if (!isMounted) return;
        if (expired) {
          setSession(null);
          setUser(null);
          setSessionExpired(true);
        } else {
          hadActiveSessionRef.current = Boolean(freshSession);
          setSession(freshSession);
          setUser(freshSession?.user ?? null);
        }
      } else {
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    }).catch((err: Error) => {
      if (isMounted) {
        setError(err.message);
        setLoading(false);
      }
    });

    // Listen to Supabase Auth lifecycle events
    const subscription = authService.onAuthStateChange((event, newSession, newUser) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        if (hadActiveSessionRef.current && !manualSignOutRef.current) {
          setSessionExpired(true);
        }
        hadActiveSessionRef.current = false;
        manualSignOutRef.current = false;
      } else if (newSession) {
        hadActiveSessionRef.current = true;
        setSessionExpired(false);
      }

      setSession(newSession);
      setUser(newUser);
      setLoading(false);
    });

    // Re-validate / refresh session when returning to PWA or reconnecting online
    const handleResume = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && hadActiveSessionRef.current) {
        authService.refreshSession().then(({ session: freshSession, expired }) => {
          if (!isMounted) return;
          if (expired) {
            hadActiveSessionRef.current = false;
            setSession(null);
            setUser(null);
            setSessionExpired(true);
          } else if (freshSession) {
            setSession(freshSession);
            setUser(freshSession.user);
          }
        }).catch(() => {
          // Ignore transient network errors when offline
        });
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleResume);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, []);

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    try {
      setError(null);
      setSessionExpired(false);
      const data = await authService.signUp(email, password);
      const alreadyRegistered = Boolean(
        data.user && (!data.user.identities || data.user.identities.length === 0)
      );
      return {
        requiresEmailConfirmation: !data.session,
        alreadyRegistered,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check your credentials.';
      setError(msg);
      throw err;
    }
  };

  const resendConfirmationEmail = async (email: string): Promise<void> => {
    try {
      setError(null);
      await authService.resendConfirmationEmail(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend confirmation email.';
      setError(msg);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setSessionExpired(false);
      await authService.signIn(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please check your credentials.';
      setError(msg);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      manualSignOutRef.current = true;
      await authService.signOut();
      hadActiveSessionRef.current = false;
      setSession(null);
      setUser(null);
      setSessionExpired(false);
    } catch (err: unknown) {
      manualSignOutRef.current = false;
      const msg = err instanceof Error ? err.message : 'Failed to sign out.';
      setError(msg);
      throw err;
    }
  };

  const clearError = () => setError(null);
  const clearSessionExpired = () => setSessionExpired(false);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        error,
        sessionExpired,
        signUp,
        resendConfirmationEmail,
        signIn,
        signOut,
        clearError,
        clearSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
