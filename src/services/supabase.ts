import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export interface SupabaseConfigStatus {
  isValid: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  isPlaceholder: boolean;
  error?: string;
}

export function checkSupabaseConfig(): SupabaseConfigStatus {
  if (!envUrl && !envAnonKey) {
    return {
      isValid: false,
      hasUrl: false,
      hasAnonKey: false,
      isPlaceholder: false,
      error: 'Missing both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment variables.',
    };
  }

  if (!envUrl) {
    return {
      isValid: false,
      hasUrl: false,
      hasAnonKey: true,
      isPlaceholder: false,
      error: 'Missing VITE_SUPABASE_URL in environment variables.',
    };
  }

  if (!envAnonKey) {
    return {
      isValid: false,
      hasUrl: true,
      hasAnonKey: false,
      isPlaceholder: false,
      error: 'Missing VITE_SUPABASE_ANON_KEY in environment variables.',
    };
  }

  // Detect placeholder values
  const isPlaceholderUrl =
    envUrl.includes('placeholder') ||
    envUrl.includes('your-project-ref') ||
    envUrl.includes('your-project-id');
  const isPlaceholderKey =
    envAnonKey.includes('placeholder') ||
    envAnonKey.includes('your-supabase-anon-key');

  if (isPlaceholderUrl || isPlaceholderKey) {
    return {
      isValid: false,
      hasUrl: true,
      hasAnonKey: true,
      isPlaceholder: true,
      error: 'Placeholder credentials detected. Please configure real Supabase project credentials in .env.',
    };
  }

  // URL format validation
  try {
    const parsed = new URL(envUrl);
    if (!parsed.protocol.startsWith('http')) {
      return {
        isValid: false,
        hasUrl: true,
        hasAnonKey: true,
        isPlaceholder: false,
        error: 'VITE_SUPABASE_URL must be a valid HTTP/HTTPS URL.',
      };
    }
  } catch {
    return {
      isValid: false,
      hasUrl: true,
      hasAnonKey: true,
      isPlaceholder: false,
      error: 'VITE_SUPABASE_URL format is invalid.',
    };
  }

  // Security check: Guard against accidental secret or service_role key usage
  if (envAnonKey.startsWith('sb_secret_')) {
    return {
      isValid: false,
      hasUrl: true,
      hasAnonKey: true,
      isPlaceholder: false,
      error: 'CRITICAL SECURITY ERROR: Supabase secret key (sb_secret_...) detected! Use the publishable key (sb_publishable_...) or anon key in frontend code.',
    };
  }

  const isPublishableKey = envAnonKey.startsWith('sb_publishable_');
  const isLegacyJwt = envAnonKey.startsWith('eyJ') && envAnonKey.split('.').length === 3;

  if (!isPublishableKey && !isLegacyJwt) {
    return {
      isValid: false,
      hasUrl: true,
      hasAnonKey: true,
      isPlaceholder: false,
      error: 'Invalid VITE_SUPABASE_ANON_KEY format. Expected a Supabase publishable key (sb_publishable_...) or legacy anon JWT key (eyJ...). Check .env for typos.',
    };
  }

  try {
    if (isLegacyJwt) {
      const parts = envAnonKey.split('.');
      const payload = JSON.parse(atob(parts[1]));
      if (payload.role === 'service_role') {
        return {
          isValid: false,
          hasUrl: true,
          hasAnonKey: true,
          isPlaceholder: false,
          error: 'CRITICAL SECURITY ERROR: service_role key detected! Never expose the service_role key in frontend client applications.',
        };
      }
    }
  } catch {
    // If JWT cannot be parsed, ignore and continue
  }

  return {
    isValid: true,
    hasUrl: true,
    hasAnonKey: true,
    isPlaceholder: false,
  };
}

export const configStatus = checkSupabaseConfig();
export const isConfigured = configStatus.isValid;

// Fallback safe URL and key to prevent createClient from crashing the whole app bundle
const clientUrl = configStatus.isValid ? envUrl : (envUrl || 'https://placeholder.supabase.co');
const clientKey = configStatus.isValid ? envAnonKey : (envAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder');

export const supabase: SupabaseClient<Database> = createClient<Database>(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'myday-auth-session',
    flowType: 'pkce',
  },
});
