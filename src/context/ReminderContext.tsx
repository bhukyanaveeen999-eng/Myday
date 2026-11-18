import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { taskService, TASKS_UPDATED_EVENT } from '../services/taskService';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadCachedNotificationPreferences,
  notificationService,
  type BrowserNotificationPermission,
} from '../services/notificationService';
import type { NotificationMode, NotificationPreferences, Task } from '../types/database.types';
import { alarmAudio } from '../utils/alarmAudio';
import {
  SNOOZE_MINUTES,
  computeSnoozeUntilIso,
  getDueReminders,
  getEffectiveReminderTime,
  getNextUpcomingReminderDelayMs,
  getReminderOccurrenceKey,
  shouldBlinkForMode,
  shouldRingForMode,
} from '../utils/reminderScheduler';
import { formatDateTime } from '../utils/dateUtils';

export interface ActiveReminderItem {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  effectiveDueAt: string;
  mode: NotificationMode;
  isTest: boolean;
  isMissed: boolean;
}

interface ReminderContextType {
  preferences: NotificationPreferences;
  preferencesLoading: boolean;
  browserPermission: BrowserNotificationPermission;
  audioUnlocked: boolean;
  audioBlocked: boolean;
  activeQueue: ActiveReminderItem[];
  activeAlertStopped: boolean;
  upcomingCount: number;
  nextDueAt: string | null;
  isDeviceSubscribed: boolean;
  registeredDeviceCount: number;
  updatePreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
  requestNotificationPermission: () => Promise<BrowserNotificationPermission>;
  unlockAudioManually: () => Promise<boolean>;
  previewAlarmSound: () => Promise<boolean>;
  triggerTestNotification: () => Promise<void>;
  stopActiveAlert: () => void;
  snoozeReminder: (item: ActiveReminderItem, minutes?: number) => Promise<void>;
  dismissReminder: (item: ActiveReminderItem) => Promise<void>;
  completeReminder: (item: ActiveReminderItem) => Promise<void>;
  refreshReminders: () => Promise<void>;
  toggleWebPush: (enable: boolean) => Promise<{ ok: boolean; message?: string }>;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

export const ReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const userId = user?.id;

  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    loadCachedNotificationPreferences(userId)
  );
  const [preferencesLoading, setPreferencesLoading] = useState<boolean>(false);
  const [browserPermission, setBrowserPermission] = useState<BrowserNotificationPermission>(() =>
    notificationService.getBrowserPermission()
  );
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => alarmAudio.isAudioUnlocked());
  const [audioBlocked, setAudioBlocked] = useState<boolean>(false);

  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [activeQueue, setActiveQueue] = useState<ActiveReminderItem[]>([]);
  const [activeAlertStopped, setActiveAlertStopped] = useState<boolean>(false);
  const [isDeviceSubscribed, setIsDeviceSubscribed] = useState<boolean>(false);
  const [registeredDeviceCount, setRegisteredDeviceCount] = useState<number>(0);

  // Deduplication set for reminders already queued/handled in this session
  const handledKeysRef = useRef<Set<string>>(new Set());
  const prefsRef = useRef<NotificationPreferences>(preferences);
  const nextTimerRef = useRef<number | null>(null);

  useEffect(() => {
    prefsRef.current = preferences;
    alarmAudio.setVolume(preferences.volume);
  }, [preferences]);

  // Global first-gesture audio unlock to handle browser autoplay restrictions cleanly
  useEffect(() => {
    const handleFirstInteraction = () => {
      alarmAudio.unlockAudio().then((unlocked) => {
        if (unlocked) {
          setAudioUnlocked(true);
          setAudioBlocked(false);
        }
      });
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // Load preferences & reset state when user changes or logs out
  useEffect(() => {
    if (!userId || !session) {
      alarmAudio.stopAlarm();
      setActiveQueue([]);
      setPendingTasks([]);
      setActiveAlertStopped(false);
      setIsDeviceSubscribed(false);
      setRegisteredDeviceCount(0);
      handledKeysRef.current.clear();
      setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
      return;
    }

    let isMounted = true;
    setPreferences(loadCachedNotificationPreferences(userId));
    setBrowserPermission(notificationService.getBrowserPermission());
    setPreferencesLoading(true);

    Promise.all([
      notificationService.getPreferences(userId).catch(() => null),
      notificationService.getPushDeviceStatus(userId).catch(() => null),
    ])
      .then(([prefs, pushStatus]) => {
        if (!isMounted) return;
        if (prefs) setPreferences(prefs);
        if (pushStatus) {
          setIsDeviceSubscribed(pushStatus.isThisDeviceSubscribed);
          setRegisteredDeviceCount(pushStatus.deviceCount);
        }
      })
      .finally(() => {
        if (isMounted) setPreferencesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, session]);

  const refreshReminders = useCallback(async () => {
    if (!userId || !session) return;
    try {
      const tasks = await taskService.getTasks('pending');
      setPendingTasks(tasks);
    } catch {
      // Ignore transient offline errors
    }
  }, [userId, session]);

  // Trigger an active reminder alert (sound + blinking card + native notification)
  const activateReminderEffects = useCallback(async (item: ActiveReminderItem) => {
    const prefs = prefsRef.current;

    // 1. Alarm sound for 'ring' or 'both'
    if (shouldRingForMode(item.mode)) {
      const started = await alarmAudio.startRepeatingAlarm(prefs.sound, prefs.volume);
      setAudioUnlocked(alarmAudio.isAudioUnlocked());
      setAudioBlocked(!started);
    } else {
      alarmAudio.stopAlarm();
      setAudioBlocked(false);
    }

    // 2. Native Browser / PWA notification when enabled & permitted
    if (prefs.browser_notifications_enabled && notificationService.getBrowserPermission() === 'granted') {
      const timeLabel = item.scheduledAt ? formatDateTime(item.scheduledAt) : 'Due now';
      const bodyParts = [
        item.isMissed ? `Missed reminder (${timeLabel})` : `Scheduled: ${timeLabel}`,
        item.description ? item.description : '',
      ].filter(Boolean);

      await notificationService.showNativeNotification({
        taskId: item.taskId,
        title: item.isTest ? `Test Reminder: ${item.title}` : `Reminder: ${item.title}`,
        body: bodyParts.join(' — '),
        silent: item.mode === 'silent' || item.mode === 'blink',
        isTest: item.isTest,
      });
    }
  }, []);

  // Evaluate pending tasks to see which reminders are due right now
  const evaluateDueReminders = useCallback(
    (tasks: Task[]) => {
      const prefs = prefsRef.current;
      if (!prefs.enabled) return;

      const nowMs = Date.now();
      const dueTasks = getDueReminders(tasks, nowMs, handledKeysRef.current);
      if (dueTasks.length === 0) return;

      const newItems: ActiveReminderItem[] = [];
      for (const task of dueTasks) {
        const effectiveIso = getEffectiveReminderTime(task);
        if (!effectiveIso) continue;
        const occurrenceKey = getReminderOccurrenceKey(task.id, effectiveIso);
        handledKeysRef.current.add(occurrenceKey);

        const dueMs = new Date(effectiveIso).getTime();
        const isMissed = nowMs - dueMs > 90_000;

        newItems.push({
          id: occurrenceKey,
          taskId: task.id,
          title: task.title,
          description: task.description,
          scheduledAt: task.scheduled_at,
          effectiveDueAt: effectiveIso,
          mode: prefs.mode,
          isTest: false,
          isMissed,
        });
      }

      if (newItems.length === 0) return;

      setActiveAlertStopped(false);
      setActiveQueue((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const unique = newItems.filter((item) => !existingIds.has(item.id));
        if (unique.length === 0) return prev;
        return [...prev, ...unique];
      });

      // Trigger sound + native notification for newly due items
      void activateReminderEffects(newItems[0]);
      // For additional simultaneous reminders, also dispatch their native notifications
      for (let i = 1; i < newItems.length; i++) {
        const extra = newItems[i];
        if (prefs.browser_notifications_enabled && notificationService.getBrowserPermission() === 'granted') {
          void notificationService.showNativeNotification({
            taskId: extra.taskId,
            title: `Reminder: ${extra.title}`,
            body: extra.scheduledAt ? `Scheduled: ${formatDateTime(extra.scheduledAt)}` : 'Due now',
            silent: extra.mode === 'silent' || extra.mode === 'blink',
          });
        }
      }
    },
    [activateReminderEffects]
  );

  // Schedule exact wakeup timer for the next upcoming reminder + 15s fallback check
  useEffect(() => {
    if (!userId || !session) return;

    evaluateDueReminders(pendingTasks);

    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }

    const delayMs = getNextUpcomingReminderDelayMs(pendingTasks, Date.now());
    if (delayMs !== null) {
      // Cap setTimeout at 15 minutes to avoid JS 32-bit timer overflow & clock drift
      const cappedDelay = Math.min(delayMs, 15 * 60 * 1000);
      nextTimerRef.current = window.setTimeout(() => {
        evaluateDueReminders(pendingTasks);
      }, cappedDelay);
    }

    const intervalId = window.setInterval(() => {
      evaluateDueReminders(pendingTasks);
    }, 15_000);

    return () => {
      if (nextTimerRef.current !== null) {
        window.clearTimeout(nextTimerRef.current);
        nextTimerRef.current = null;
      }
      window.clearInterval(intervalId);
    };
  }, [userId, session, pendingTasks, preferences.enabled, preferences.mode, evaluateDueReminders]);

  // Keep tasks synced on startup, task mutations, visibility resume, and reconnect
  useEffect(() => {
    if (!userId || !session) return;

    void refreshReminders();

    const handleTasksUpdated = () => {
      void refreshReminders();
    };

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        setBrowserPermission(notificationService.getBrowserPermission());
        void refreshReminders();
      }
    };

    window.addEventListener(TASKS_UPDATED_EVENT, handleTasksUpdated);
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleTasksUpdated);

    return () => {
      window.removeEventListener(TASKS_UPDATED_EVENT, handleTasksUpdated);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleTasksUpdated);
    };
  }, [userId, session, refreshReminders]);

  // Stop sound when active queue becomes empty
  useEffect(() => {
    if (activeQueue.length === 0) {
      alarmAudio.stopAlarm();
      setAudioBlocked(false);
      setActiveAlertStopped(false);
    }
  }, [activeQueue.length]);

  const stopActiveAlert = useCallback(() => {
    alarmAudio.stopAlarm();
    setAudioBlocked(false);
    setActiveAlertStopped(true);
  }, []);

  const advanceQueue = useCallback((handledId: string) => {
    alarmAudio.stopAlarm();
    setAudioBlocked(false);
    setActiveAlertStopped(false);

    setActiveQueue((prev) => {
      const remaining = prev.filter((item) => item.id !== handledId);
      if (remaining.length > 0 && shouldRingForMode(remaining[0].mode)) {
        void alarmAudio.startRepeatingAlarm(prefsRef.current.sound, prefsRef.current.volume);
      }
      return remaining;
    });
  }, []);

  const snoozeReminder = useCallback(
    async (item: ActiveReminderItem, minutes: number = SNOOZE_MINUTES) => {
      advanceQueue(item.id);
      if (item.isTest) return;

      const snoozeIso = computeSnoozeUntilIso(Date.now(), minutes);
      try {
        await taskService.snoozeTaskReminder(item.taskId, snoozeIso);
        await refreshReminders();
      } catch (err) {
        console.error('[ReminderContext.snoozeReminder]', err);
      }
    },
    [advanceQueue, refreshReminders]
  );

  const dismissReminder = useCallback(
    async (item: ActiveReminderItem) => {
      advanceQueue(item.id);
      if (item.isTest) return;

      try {
        await taskService.dismissTaskReminder(item.taskId);
        await refreshReminders();
      } catch (err) {
        console.error('[ReminderContext.dismissReminder]', err);
      }
    },
    [advanceQueue, refreshReminders]
  );

  const completeReminder = useCallback(
    async (item: ActiveReminderItem) => {
      advanceQueue(item.id);
      if (item.isTest) return;

      try {
        await taskService.updateTask(item.taskId, { status: 'completed' });
        await refreshReminders();
      } catch (err) {
        console.error('[ReminderContext.completeReminder]', err);
      }
    },
    [advanceQueue, refreshReminders]
  );

  // Listen for Service Worker notification action messages (Snooze / Dismiss)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        action?: string;
        taskId?: string;
        isTest?: boolean;
      };
      if (data?.type !== 'MYDAY_REMINDER_ACTION' || !data.taskId) return;

      const matching = activeQueue.find((item) => item.taskId === data.taskId);
      if (data.action === 'snooze') {
        if (matching) {
          void snoozeReminder(matching);
        } else if (!data.isTest) {
          void taskService.snoozeTaskReminder(data.taskId, computeSnoozeUntilIso());
        }
      } else if (data.action === 'dismiss') {
        if (matching) {
          void dismissReminder(matching);
        } else if (!data.isTest) {
          void taskService.dismissTaskReminder(data.taskId);
        }
      } else if (data.action === 'stop') {
        stopActiveAlert();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [activeQueue, snoozeReminder, dismissReminder, stopActiveAlert]);

  const updatePreferences = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!userId) return;
      const optimistic = { ...prefsRef.current, ...patch };
      setPreferences(optimistic);
      alarmAudio.setVolume(optimistic.volume);

      if (patch.enabled === false) {
        alarmAudio.stopAlarm();
        setActiveQueue([]);
      }

      try {
        const saved = await notificationService.savePreferences(userId, patch);
        setPreferences(saved);
      } catch (err) {
        console.error('[ReminderContext.updatePreferences]', err);
        throw err;
      }
    },
    [userId]
  );

  const requestNotificationPermission = useCallback(async () => {
    const result = await notificationService.requestBrowserPermission();
    setBrowserPermission(result);
    return result;
  }, []);

  const unlockAudioManually = useCallback(async () => {
    const unlocked = await alarmAudio.unlockAudio();
    setAudioUnlocked(unlocked);
    if (unlocked) {
      setAudioBlocked(false);
      // If an active ringing alert was waiting on autoplay unlock, start ringing now
      const current = activeQueue[0];
      if (current && !activeAlertStopped && shouldRingForMode(current.mode)) {
        await alarmAudio.startRepeatingAlarm(prefsRef.current.sound, prefsRef.current.volume);
      }
    }
    return unlocked;
  }, [activeQueue, activeAlertStopped]);

  const previewAlarmSound = useCallback(async () => {
    const ok = await alarmAudio.previewSound(prefsRef.current.sound, prefsRef.current.volume);
    setAudioUnlocked(ok);
    setAudioBlocked(!ok);
    return ok;
  }, []);

  const triggerTestNotification = useCallback(async () => {
    const prefs = prefsRef.current;
    const nowIso = new Date().toISOString();
    const testItem: ActiveReminderItem = {
      id: `test::${Date.now()}`,
      taskId: 'test-reminder',
      title: 'Test Reminder Alert',
      description: `Mode: ${prefs.mode.toUpperCase()} — ${
        shouldRingForMode(prefs.mode) ? `Sound (${prefs.sound})` : 'No sound'
      }${shouldBlinkForMode(prefs.mode) ? ' + Blinking Alert' : ''}`,
      scheduledAt: nowIso,
      effectiveDueAt: nowIso,
      mode: prefs.mode,
      isTest: true,
      isMissed: false,
    };

    setActiveAlertStopped(false);
    setActiveQueue((prev) => [testItem, ...prev.filter((i) => !i.isTest)]);
    await activateReminderEffects(testItem);
  }, [activateReminderEffects]);

  const toggleWebPush = useCallback(
    async (enable: boolean): Promise<{ ok: boolean; message?: string }> => {
      if (!userId) return { ok: false, message: 'Sign in first to configure push notifications.' };

      if (!enable) {
        await notificationService.unsubscribeDeviceFromWebPush(userId);
        const status = await notificationService.getPushDeviceStatus(userId);
        setIsDeviceSubscribed(status.isThisDeviceSubscribed);
        setRegisteredDeviceCount(status.deviceCount);
        await updatePreferences({ push_enabled: status.deviceCount > 0 });
        return { ok: true, message: 'Background Web Push unsubscribed on this device.' };
      }

      const res = await notificationService.subscribeDeviceToWebPush(userId);
      setBrowserPermission(notificationService.getBrowserPermission());
      if (!res.subscribed) {
        return { ok: false, message: res.reason || 'Could not subscribe device to Web Push.' };
      }

      const status = await notificationService.getPushDeviceStatus(userId);
      setIsDeviceSubscribed(status.isThisDeviceSubscribed);
      setRegisteredDeviceCount(status.deviceCount);
      await updatePreferences({ push_enabled: true });
      return {
        ok: true,
        message: `This device is now registered for background Web Push (${status.deviceCount} ${
          status.deviceCount === 1 ? 'device' : 'devices'
        } active).`,
      };
    },
    [userId, updatePreferences]
  );

  // Summary of upcoming scheduled reminders for status indicators
  const scheduledUpcoming = pendingTasks.filter((t) => Boolean(getEffectiveReminderTime(t)));
  const nextDelay = getNextUpcomingReminderDelayMs(pendingTasks, Date.now());
  const nextDueAt =
    nextDelay !== null ? new Date(Date.now() + nextDelay).toISOString() : null;

  return (
    <ReminderContext.Provider
      value={{
        preferences,
        preferencesLoading,
        browserPermission,
        audioUnlocked,
        audioBlocked,
        activeQueue,
        activeAlertStopped,
        upcomingCount: scheduledUpcoming.length,
        nextDueAt,
        isDeviceSubscribed,
        registeredDeviceCount,
        updatePreferences,
        requestNotificationPermission,
        unlockAudioManually,
        previewAlarmSound,
        triggerTestNotification,
        stopActiveAlert,
        snoozeReminder,
        dismissReminder,
        completeReminder,
        refreshReminders,
        toggleWebPush,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
};

export const useReminders = (): ReminderContextType => {
  const ctx = useContext(ReminderContext);
  if (!ctx) {
    throw new Error('useReminders must be used within a ReminderProvider');
  }
  return ctx;
};

