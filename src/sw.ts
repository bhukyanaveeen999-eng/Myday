/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();

// Precache static app-shell assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA offline fallback for navigation routes
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api/, /^\/auth/],
  })
);

// Never cache Supabase authentication or private user data
registerRoute(/^https:\/\/.*\.supabase\.co\/.*/i, new NetworkOnly(), 'GET');

interface PushReminderPayload {
  taskId?: string;
  title?: string;
  description?: string | null;
  body?: string;
  scheduledAt?: string;
  mode?: 'ring' | 'blink' | 'both' | 'silent';
  silent?: boolean;
  vibrate?: number[];
  url?: string;
}

// Handle real Web Push events when browser / PWA is closed or backgrounded
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: PushReminderPayload = {};
  try {
    payload = event.data.json() as PushReminderPayload;
  } catch {
    payload = { title: 'MyDay Reminder', body: event.data.text() };
  }

  const taskId = payload.taskId || 'push-reminder';
  const title = payload.title || 'MyDay Reminder';
  const body = payload.body || payload.description || 'You have a scheduled reminder due now.';
  const silent = Boolean(payload.silent || payload.mode === 'silent' || payload.mode === 'blink');
  const url = payload.url || `/tasks?reminder=${encodeURIComponent(taskId)}`;
  const vibrate = Array.isArray(payload.vibrate)
    ? payload.vibrate
    : silent
    ? []
    : [220, 120, 220];

  const options: NotificationOptions & {
    actions?: Array<{ action: string; title: string }>;
    renotify?: boolean;
    vibrate?: number[];
  } = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `myday-reminder-${taskId}`,
    renotify: !silent,
    silent,
    vibrate,
    requireInteraction: !silent,
    data: { taskId, url, mode: payload.mode || 'both' },
    actions: [
      { action: 'snooze', title: 'Snooze 5m' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click and action buttons (Snooze / Dismiss / Stop / Open)
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const data = (event.notification.data || {}) as {
    taskId?: string;
    url?: string;
    isTest?: boolean;
  };
  const action = event.action || 'open';
  const taskId = data.taskId;

  let targetUrl = data.url || '/tasks';
  if (!data.isTest && taskId && (action === 'snooze' || action === 'dismiss' || action === 'stop')) {
    targetUrl = `/tasks?reminder=${encodeURIComponent(taskId)}&action=${encodeURIComponent(action)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'MYDAY_REMINDER_ACTION',
            action,
            taskId,
            isTest: Boolean(data.isTest),
          });
          if ('navigate' in client && action === 'open') {
            void (client as WindowClient).navigate(targetUrl);
          }
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
