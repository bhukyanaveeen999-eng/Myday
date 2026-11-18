import { supabase } from './supabase';
import type {
  AlarmSoundId,
  NotificationMode,
  NotificationPreferences,
} from '../types/database.types';

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  mode: 'both',
  sound: 'chime',
  volume: 0.75,
  browser_notifications_enabled: true,
  push_enabled: false,
};

const PREFS_CACHE_PREFIX = 'myday_notif_prefs_';

function getCacheKey(userId: string): string {
  return `${PREFS_CACHE_PREFIX}${userId}`;
}

export function loadCachedNotificationPreferences(
  userId: string | undefined
): NotificationPreferences {
  if (!userId || typeof localStorage === 'undefined') {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  try {
    const raw = localStorage.getItem(getCacheKey(userId));
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return normalizePreferences(parsed);
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

function saveCachedNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
): void {
  try {
    localStorage.setItem(getCacheKey(userId), JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

function normalizePreferences(
  raw: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  const validModes: NotificationMode[] = ['ring', 'blink', 'both', 'silent'];
  const validSounds: AlarmSoundId[] = ['chime', 'bell', 'pulse', 'gentle'];
  const mode = raw?.mode && validModes.includes(raw.mode) ? raw.mode : DEFAULT_NOTIFICATION_PREFERENCES.mode;
  const sound = raw?.sound && validSounds.includes(raw.sound) ? raw.sound : DEFAULT_NOTIFICATION_PREFERENCES.sound;
  const vol =
    typeof raw?.volume === 'number' && !Number.isNaN(raw.volume)
      ? Math.max(0, Math.min(1, raw.volume))
      : DEFAULT_NOTIFICATION_PREFERENCES.volume;

  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    mode,
    sound,
    volume: vol,
    browser_notifications_enabled:
      typeof raw?.browser_notifications_enabled === 'boolean'
        ? raw.browser_notifications_enabled
        : DEFAULT_NOTIFICATION_PREFERENCES.browser_notifications_enabled,
    push_enabled:
      typeof raw?.push_enabled === 'boolean'
        ? raw.push_enabled
        : DEFAULT_NOTIFICATION_PREFERENCES.push_enabled,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isValidVapidPublicKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 80 || trimmed.length > 100) return false;
  try {
    const bytes = urlBase64ToUint8Array(trimmed);
    // RFC 8292 P-256 uncompressed public key is exactly 65 bytes starting with 0x04
    return bytes.length === 65 && bytes[0] === 0x04;
  } catch {
    return false;
  }
}

export interface NativeReminderNotificationPayload {
  taskId: string;
  title: string;
  body: string;
  silent: boolean;
  isTest?: boolean;
}

export const notificationService = {
  getBrowserPermission(): BrowserNotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  },

  async requestBrowserPermission(): Promise<BrowserNotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  },

  getVapidPublicKey(): string | null {
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
    return isValidVapidPublicKey(key) ? (key as string) : null;
  },

  isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  async getPushDeviceStatus(userId: string): Promise<{
    isThisDeviceSubscribed: boolean;
    deviceCount: number;
  }> {
    let localEndpoint: string | null = null;
    if (this.isPushSupported()) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        localEndpoint = sub?.endpoint ?? null;
      } catch {
        localEndpoint = null;
      }
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', userId);

    if (error || !data) {
      return { isThisDeviceSubscribed: false, deviceCount: 0 };
    }

    const endpoints = data.map((row) => row.endpoint);
    return {
      isThisDeviceSubscribed: Boolean(localEndpoint && endpoints.includes(localEndpoint)),
      deviceCount: endpoints.length,
    };
  },

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('enabled, mode, sound, volume, browser_notifications_enabled, push_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const normalized = normalizePreferences(data);
    saveCachedNotificationPreferences(userId, normalized);
    return normalized;
  },

  async savePreferences(
    userId: string,
    patch: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const current = loadCachedNotificationPreferences(userId);
    const merged = normalizePreferences({ ...current, ...patch });

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          enabled: merged.enabled,
          mode: merged.mode,
          sound: merged.sound,
          volume: merged.volume,
          browser_notifications_enabled: merged.browser_notifications_enabled,
          push_enabled: merged.push_enabled,
        },
        { onConflict: 'user_id' }
      )
      .select('enabled, mode, sound, volume, browser_notifications_enabled, push_enabled')
      .single();

    if (error) {
      throw error;
    }

    const saved = normalizePreferences(data);
    saveCachedNotificationPreferences(userId, saved);
    return saved;
  },

  async showNativeNotification(payload: NativeReminderNotificationPayload): Promise<boolean> {
    if (this.getBrowserPermission() !== 'granted') {
      return false;
    }

    const notificationOptions: NotificationOptions & {
      actions?: Array<{ action: string; title: string }>;
      renotify?: boolean;
      vibrate?: number[];
    } = {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.isTest ? 'myday-test-notification' : `myday-reminder-${payload.taskId}`,
      silent: payload.silent,
      requireInteraction: !payload.silent,
      data: {
        taskId: payload.taskId,
        isTest: Boolean(payload.isTest),
        url: payload.isTest ? '/settings' : `/tasks?reminder=${encodeURIComponent(payload.taskId)}`,
      },
      actions: payload.isTest
        ? [{ action: 'open', title: 'Open Settings' }]
        : [
            { action: 'snooze', title: 'Snooze 5 min' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(payload.title, notificationOptions);
          return true;
        }
      }
    } catch {
      // Fall through to standard Window Notification API
    }

    try {
      const notif = new Notification(payload.title, {
        body: payload.body,
        icon: '/pwa-192x192.png',
        tag: notificationOptions.tag,
        silent: payload.silent,
      });
      notif.onclick = () => {
        window.focus();
        if (!payload.isTest) {
          window.location.assign(`/tasks?reminder=${encodeURIComponent(payload.taskId)}`);
        }
        notif.close();
      };
      return true;
    } catch {
      return false;
    }
  },

  async subscribeDeviceToWebPush(userId: string): Promise<{ subscribed: boolean; reason?: string }> {
    if (!this.isPushSupported()) {
      return { subscribed: false, reason: 'This browser does not support Web Push API.' };
    }

    const vapidKey = this.getVapidPublicKey();
    if (!vapidKey) {
      return {
        subscribed: false,
        reason: 'VITE_VAPID_PUBLIC_KEY is not configured yet. Add your public VAPID key to .env to enable background Web Push.',
      };
    }

    const permission = await this.requestBrowserPermission();
    if (permission !== 'granted') {
      return { subscribed: false, reason: 'Notification permission was not granted.' };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const keyBytes = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer as ArrayBuffer,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { subscribed: false, reason: 'Browser returned an incomplete push subscription.' };
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 250),
      },
      { onConflict: 'user_id,endpoint' }
    );

    if (error) {
      throw error;
    }

    return { subscribed: true };
  },

  async unsubscribeDeviceFromWebPush(userId: string): Promise<void> {
    if (!this.isPushSupported()) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
      }
    } catch {
      // Ignore unsubscribe cleanup failures
    }
  },
};

