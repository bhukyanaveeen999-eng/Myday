import React, { useState } from 'react';
import { useReminders } from '../context/ReminderContext';
import { notificationService } from '../services/notificationService';
import { ALARM_SOUND_OPTIONS } from '../utils/alarmAudio';
import type { AlarmSoundId, NotificationMode } from '../types/database.types';
import { formatDateTime } from '../utils/dateUtils';
import {
  Bell,
  BellOff,
  BellRing,
  Volume2,
  VolumeX,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Smartphone,
  Clock,
  Loader2,
} from 'lucide-react';

const NOTIFICATION_MODES: Array<{
  id: NotificationMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'ring',
    label: 'Ring',
    description: 'Play the repeating alarm sound when a reminder becomes due.',
    icon: Volume2,
  },
  {
    id: 'blink',
    label: 'Blink',
    description: 'Show a subtle visually blinking alert without playing sound.',
    icon: Sparkles,
  },
  {
    id: 'both',
    label: 'Both (Ring + Blink)',
    description: 'Play the repeating alarm sound and show a blinking alert together.',
    icon: BellRing,
  },
  {
    id: 'silent',
    label: 'Silent',
    description: 'Display a calm standard notification without sound or blinking.',
    icon: VolumeX,
  },
];

export const SettingsPage: React.FC = () => {
  const {
    preferences,
    preferencesLoading,
    browserPermission,
    audioUnlocked,
    upcomingCount,
    nextDueAt,
    isDeviceSubscribed,
    registeredDeviceCount,
    updatePreferences,
    requestNotificationPermission,
    unlockAudioManually,
    previewAlarmSound,
    triggerTestNotification,
    toggleWebPush,
  } = useReminders();

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const hasVapidKey = Boolean(notificationService.getVapidPublicKey());
  const pushSupported = notificationService.isPushSupported();

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
  };

  const handleToggleEnabled = async () => {
    try {
      await updatePreferences({ enabled: !preferences.enabled });
      showFeedback('success', !preferences.enabled ? 'Reminder notifications enabled.' : 'Reminder notifications paused.');
    } catch {
      showFeedback('error', 'Could not save preference. Please check your connection.');
    }
  };

  const handleModeChange = async (mode: NotificationMode) => {
    try {
      await updatePreferences({ mode });
      showFeedback('success', `Notification mode set to "${mode}".`);
    } catch {
      showFeedback('error', 'Failed to update notification mode.');
    }
  };

  const handleSoundChange = async (sound: AlarmSoundId) => {
    try {
      await updatePreferences({ sound });
    } catch {
      showFeedback('error', 'Failed to update alarm sound.');
    }
  };

  const handleVolumeCommit = async (volume: number) => {
    try {
      await updatePreferences({ volume });
    } catch {
      showFeedback('error', 'Failed to update volume.');
    }
  };

  const handlePreviewSound = async () => {
    const ok = await previewAlarmSound();
    if (!ok) {
      showFeedback('error', 'Audio playback is unavailable in this browser.');
    }
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    if (result === 'granted') {
      await updatePreferences({ browser_notifications_enabled: true });
      showFeedback('success', 'Browser notification permission granted.');
    } else if (result === 'denied') {
      showFeedback(
        'error',
        'Notification permission was blocked. Enable notifications for this site in your browser settings.'
      );
    }
  };

  const handleToggleBrowserNotifications = async () => {
    const next = !preferences.browser_notifications_enabled;
    if (next && browserPermission === 'default') {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') {
        showFeedback('error', 'Permission not granted. Browser notifications remain off.');
        return;
      }
    }
    try {
      await updatePreferences({ browser_notifications_enabled: next });
      showFeedback('success', next ? 'Browser notifications enabled.' : 'Browser notifications disabled.');
    } catch {
      showFeedback('error', 'Failed to update browser notification setting.');
    }
  };

  const handleToggleWebPush = async () => {
    setPushBusy(true);
    try {
      const res = await toggleWebPush(!isDeviceSubscribed);
      showFeedback(res.ok ? 'success' : 'error', res.message || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update Web Push subscription.';
      showFeedback('error', msg);
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestNotification = async () => {
    await unlockAudioManually();
    if (preferences.browser_notifications_enabled && browserPermission === 'default') {
      await requestNotificationPermission();
    }
    await triggerTestNotification();
  };

  const permissionBadge = () => {
    switch (browserPermission) {
      case 'granted':
        return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Granted</span>;
      case 'denied':
        return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Blocked</span>;
      case 'default':
        return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Not Requested</span>;
      default:
        return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">Unsupported</span>;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">
            Configure reminder alarms, blinking alerts, sound, and PWA notifications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleTestNotification()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-xs transition-colors shrink-0"
        >
          <BellRing className="w-4 h-4" />
          Test Notification
        </button>
      </div>

      {/* Feedback Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-start gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs underline"
          >
            Close
          </button>
        </div>
      )}

      {/* Notification Status Indicator Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-5">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {preferences.enabled ? (
              <Bell className="w-5 h-5 text-blue-600" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <h2 className="text-base font-semibold text-gray-900">Notification Status</h2>
          </div>

          {preferencesLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                preferences.enabled
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {preferences.enabled ? `Active · ${preferences.mode.toUpperCase()}` : 'Paused'}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Scheduled</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {upcomingCount} {upcomingCount === 1 ? 'reminder' : 'reminders'}
            </p>
            {nextDueAt && (
              <p className="mt-0.5 text-[11px] text-gray-500 flex items-center gap-1 truncate">
                <Clock className="w-3 h-3 shrink-0" />
                Next: {formatDateTime(nextDueAt)}
              </p>
            )}
          </div>

          <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Browser Permission</p>
            <div className="mt-1.5">{permissionBadge()}</div>
          </div>

          <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Alarm Audio</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold ${
                  audioUnlocked ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {audioUnlocked ? 'Ready' : 'Tap to Unlock'}
              </span>
              {!audioUnlocked && (
                <button
                  type="button"
                  onClick={() => void unlockAudioManually()}
                  className="text-[11px] font-medium text-blue-600 hover:underline"
                >
                  Enable
                </button>
              )}
            </div>
          </div>

          <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Closed-App Push</p>
            <p className="mt-1 text-xs font-semibold text-gray-800">
              {isDeviceSubscribed
                ? `Active (${registeredDeviceCount} ${registeredDeviceCount === 1 ? 'device' : 'devices'})`
                : hasVapidKey
                ? registeredDeviceCount > 0
                  ? `Not on this device (${registeredDeviceCount} other)`
                  : 'Ready to Enable'
                : 'Needs VAPID Keys'}
            </p>
          </div>
        </div>
      </div>

      {/* Master Enable + Mode Selection */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-5 space-y-5">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Enable Reminder Alerts</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Trigger alarms and alerts automatically when scheduled tasks reach their due time.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.enabled}
            onClick={() => void handleToggleEnabled()}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              preferences.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                preferences.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 4 Notification Modes */}
        <div className={!preferences.enabled ? 'opacity-50 pointer-events-none' : ''}>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Notification Mode</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NOTIFICATION_MODES.map((item) => {
              const Icon = item.icon;
              const selected = preferences.mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleModeChange(item.id)}
                  className={`text-left p-4 rounded-lg border transition-all flex items-start gap-3 ${
                    selected
                      ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-md shrink-0 ${
                      selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Alarm Sound & Volume */}
        <div
          className={`pt-4 border-t border-gray-100 space-y-4 ${
            !preferences.enabled || preferences.mode === 'blink' || preferences.mode === 'silent'
              ? 'opacity-60'
              : ''
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Alarm Sound & Volume</h3>
              <p className="text-xs text-gray-500">
                Used in Ring and Both modes. Synthesized offline via Web Audio API.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePreviewSound()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Preview Sound
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="alarm-sound-select" className="block text-xs font-medium text-gray-700 mb-1">
                Alarm Tone
              </label>
              <select
                id="alarm-sound-select"
                value={preferences.sound}
                onChange={(e) => void handleSoundChange(e.target.value as AlarmSoundId)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ALARM_SOUND_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="alarm-volume-range" className="text-xs font-medium text-gray-700">
                  Alarm Volume
                </label>
                <span className="text-xs font-semibold text-gray-700">
                  {Math.round(preferences.volume * 100)}%
                </span>
              </div>
              <input
                id="alarm-volume-range"
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(preferences.volume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  void handleVolumeCommit(v);
                }}
                className="w-full accent-blue-600 cursor-pointer mt-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Native Browser & PWA Background Push Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Browser & PWA Notifications</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Display native system notifications with Snooze and Dismiss actions via the PWA Service Worker.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {browserPermission === 'default' && (
              <button
                type="button"
                onClick={() => void handleRequestPermission()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Allow Notifications
              </button>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={preferences.browser_notifications_enabled}
              disabled={browserPermission === 'unsupported' || browserPermission === 'denied'}
              onClick={() => void handleToggleBrowserNotifications()}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                preferences.browser_notifications_enabled && browserPermission === 'granted'
                  ? 'bg-blue-600'
                  : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  preferences.browser_notifications_enabled && browserPermission === 'granted'
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Denied Permission Guidance */}
        {browserPermission === 'denied' && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-800">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">Browser notifications are blocked</p>
              <p className="mt-0.5">
                In-app alarms and blinking alerts still work while MyDay is open. To re-enable native system notifications, click the lock/site-settings icon in your browser address bar, set Notifications to <strong>Allow</strong>, and refresh.
              </p>
            </div>
          </div>
        )}

        {/* Background Web Push Section */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Background Web Push (When App Is Closed)
                </h3>
              </div>
              <p className="text-xs text-gray-500">
                Delivers reminders via Web Push + Supabase Cron even when MyDay or your browser is closed.
                {registeredDeviceCount > 0 && (
                  <> Registered devices for your account: <strong>{registeredDeviceCount}</strong>.</>
                )}
              </p>
              {!hasVapidKey && (
                <p className="text-xs text-amber-700">
                  Server setup needed: configure <code className="font-mono bg-amber-50 px-1 rounded">VITE_VAPID_PUBLIC_KEY</code> in <code className="font-mono">.env</code> and deploy the <code className="font-mono">send-due-reminders</code> Supabase Edge Function.
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!pushSupported || !hasVapidKey || pushBusy || browserPermission === 'denied'}
              onClick={() => void handleToggleWebPush()}
              className={`px-3.5 py-2 text-xs font-medium rounded-md border transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDeviceSubscribed
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {pushBusy
                ? 'Updating...'
                : isDeviceSubscribed
                ? 'Disable Push on This Device'
                : 'Enable Push on This Device'}
            </button>
          </div>

          <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-md p-2.5">
            <strong>Browser &amp; OS behavior note:</strong> While MyDay is open, Ring/Blink modes play repeating custom alarm audio and visual blinking. When MyDay is closed, background Web Push shows a native OS notification respecting Silent vs. Alert mode—native notification sound and vibration are controlled by your OS and browser (browsers cannot continuously ring or blink custom UI while closed).
          </p>
        </div>
      </div>
    </div>
  );
};

