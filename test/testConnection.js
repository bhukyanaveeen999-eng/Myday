import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Parse .env directly
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        env[match[1]] = val.trim();
      }
    }
  }
  return env;
}

export async function runSupabaseConnectionTest() {
  const env = loadEnv();
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  const result = {
    envLoaded: false,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    isPlaceholder: false,
    clientInitialized: false,
    authReachable: false,
    noExposedServiceRole: true,
    error: null,
    details: '',
  };

  if (!url || !anonKey) {
    result.error = 'MISSING_ENV_VARS';
    result.details = 'Required environment variables VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing.';
    return result;
  }

  result.envLoaded = true;

  if (url.includes('placeholder') || anonKey.includes('placeholder') || url.includes('your-project-ref')) {
    result.isPlaceholder = true;
    result.error = 'PLACEHOLDER_CREDENTIALS';
    result.details = 'Credentials in .env contain placeholder values. Real Supabase URL and Publishable Key are required.';
    return result;
  }

  // Security check: secret key & service_role check
  if (anonKey.startsWith('sb_secret_')) {
    result.noExposedServiceRole = false;
    result.error = 'SECRET_KEY_EXPOSED';
    result.details = 'CRITICAL: Secret key (sb_secret_...) detected! Use the publishable key (sb_publishable_...) or anon key in frontend configuration.';
    return result;
  }

  const isPublishableKey = anonKey.startsWith('sb_publishable_');
  const isLegacyJwt = anonKey.startsWith('eyJ') && anonKey.split('.').length === 3;
  if (!isPublishableKey && !isLegacyJwt) {
    result.error = 'INVALID_KEY_FORMAT';
    result.details = 'VITE_SUPABASE_ANON_KEY does not match expected Supabase publishable (sb_publishable_...) or legacy anon JWT (eyJ...) format.';
    return result;
  }

  try {
    if (isLegacyJwt) {
      const payload = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64').toString());
      if (payload.role === 'service_role') {
        result.noExposedServiceRole = false;
        result.error = 'SERVICE_ROLE_KEY_EXPOSED';
        result.details = 'CRITICAL: The provided key has role "service_role". Never use the service_role key in frontend configuration!';
        return result;
      }
    }
  } catch {
    // If not standard JWT, continue
  }

  // URL validity check
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('URL must start with http:// or https://');
    }
  } catch (e) {
    result.error = 'INVALID_URL';
    result.details = `VITE_SUPABASE_URL is not a valid URL: ${e.message}`;
    return result;
  }

  // Initialize client
  let client;
  try {
    client = createClient(url, anonKey);
    result.clientInitialized = true;
  } catch (e) {
    result.error = 'INIT_FAILED';
    result.details = `Failed to initialize Supabase client: ${e.message}`;
    return result;
  }

  // Test reachability and API key acceptance against Supabase Auth settings
  try {
    const settingsUrl = `${url.replace(/\/$/, '')}/auth/v1/settings`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(settingsUrl, {
      method: 'GET',
      headers: {
        apikey: anonKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      result.authReachable = true;
      result.details = `Successfully reached Supabase Auth endpoint and validated API key (Status: ${res.status}).`;
    } else if (res.status === 401 || res.status === 403) {
      result.error = 'INVALID_API_KEY';
      result.details = `Supabase rejected VITE_SUPABASE_ANON_KEY with status ${res.status} (Invalid API key).`;
    } else {
      result.error = 'AUTH_UNREACHABLE';
      result.details = `Reached endpoint but received unexpected status: ${res.status} ${res.statusText}`;
    }
  } catch (e) {
    const causeCode = e?.cause?.code ? ` (${e.cause.code})` : '';
    result.error = e?.cause?.code === 'ENOTFOUND' ? 'DNS_NOT_FOUND' : 'NETWORK_ERROR';
    result.details = `Could not reach remote Supabase server: ${e.message}${causeCode}`;
  }

  return result;
}

// If run directly
if (process.argv[1] && process.argv[1].endsWith('testConnection.js')) {
  runSupabaseConnectionTest().then((res) => {
    console.log(JSON.stringify(res, null, 2));
    if (res.error) {
      process.exit(1);
    }
  });
}

