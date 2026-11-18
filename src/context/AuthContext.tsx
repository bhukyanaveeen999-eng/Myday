import React, { createContext, useContext, useEffect, useState } from 'react';
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
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial session
    authService.getSession().then((initialSession) => {
      if (isMounted) {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setLoading(false);
      }
    }).catch((err: Error) => {
      if (isMounted) {
        setError(err.message);
        setLoading(false);
      }
    });

    // Listen to auth state changes
    const subscription = authService.onAuthStateChange((newSession, newUser) => {
      if (isMounted) {
        setSession(newSession);
        setUser(newUser);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    try {
      setError(null);
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
      await authService.signOut();
      setSession(null);
      setUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out.';
      setError(msg);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        error,
        signUp,
        resendConfirmationEmail,
        signIn,
        signOut,
        clearError,
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
