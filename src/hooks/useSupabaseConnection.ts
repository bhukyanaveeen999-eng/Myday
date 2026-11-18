import { useEffect, useState } from 'react';
import { configStatus } from '../services/supabase';

export interface ConnectionDiagnostics {
  isConfigured: boolean;
  isPlaceholder: boolean;
  isReachable: boolean | null;
  checking: boolean;
  error: string | null;
}

export function useSupabaseConnection(): ConnectionDiagnostics {
  const [state, setState] = useState<ConnectionDiagnostics>({
    isConfigured: configStatus.isValid,
    isPlaceholder: configStatus.isPlaceholder,
    isReachable: null,
    checking: configStatus.isValid,
    error: configStatus.error || null,
  });

  useEffect(() => {
    if (!configStatus.isValid) {
      return;
    }

    let isMounted = true;

    async function checkHealth() {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL?.trim();
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
        if (!url || !key) return;

        const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
          method: 'GET',
          headers: { apikey: key },
        });

        if (!isMounted) return;

        if (res.ok) {
          setState({
            isConfigured: true,
            isPlaceholder: false,
            isReachable: true,
            checking: false,
            error: null,
          });
        } else if (res.status === 401 || res.status === 403) {
          setState({
            isConfigured: true,
            isPlaceholder: false,
            isReachable: false,
            checking: false,
            error: 'Supabase rejected the configured API key (Invalid API key). Verify VITE_SUPABASE_ANON_KEY in .env.',
          });
        } else {
          setState({
            isConfigured: true,
            isPlaceholder: false,
            isReachable: false,
            checking: false,
            error: `Supabase Auth returned status ${res.status}`,
          });
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Unable to reach Supabase server';
        setState({
          isConfigured: true,
          isPlaceholder: false,
          isReachable: false,
          checking: false,
          error: msg,
        });
      }
    }

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}

