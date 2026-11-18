import React from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useReminders } from '../context/ReminderContext';
import { shouldBlinkForMode, shouldRingForMode, SNOOZE_MINUTES } from '../utils/reminderScheduler';
import { formatDateTime } from '../utils/dateUtils';
import {
  BellRing,
  Bell,
  Clock,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlarmClock,
  Square,
  X,
} from 'lucide-react';

export const ReminderAlertOverlay: React.FC = () => {
  const {
    activeQueue,
    activeAlertStopped,
    audioBlocked,
    stopActiveAlert,
    snoozeReminder,
    dismissReminder,
    completeReminder,
    unlockAudioManually,
  } = useReminders();

  const current = activeQueue[0];

  if (!current) return null;

  const isBlinking = !activeAlertStopped && shouldBlinkForMode(current.mode);
  const isRinging = !activeAlertStopped && shouldRingForMode(current.mode);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          role="alertdialog"
          aria-live="assertive"
          aria-label={`Reminder: ${current.title}`}
          className="fixed top-16 left-3 right-3 sm:left-auto sm:right-5 sm:w-[400px] z-50"
        >
          <div
            className={`rounded-xl border-2 bg-white shadow-xl p-4 transition-colors ${
              isBlinking ? 'reminder-blink-active' : 'border-blue-500/80'
            }`}
          >
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isBlinking
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {isRinging ? (
                    <BellRing className="w-5 h-5" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      {current.isTest
                        ? 'Test Reminder'
                        : current.isMissed
                        ? 'Missed Reminder'
                        : 'Reminder Due'}
                    </span>
                    {activeQueue.length > 1 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                        1 of {activeQueue.length}
                      </span>
                    )}
                    {isBlinking && (
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full bg-amber-500 animate-ping"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    {formatDateTime(current.scheduledAt || current.effectiveDueAt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void dismissReminder(current)}
                aria-label="Dismiss reminder"
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="mt-3">
              <h3 className="text-base font-bold text-gray-900 leading-snug">
                {current.title}
              </h3>
              {current.description && (
                <p className="mt-1 text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">
                  {current.description}
                </p>
              )}
            </div>

            {/* Browser Autoplay Blocked Fallback Notice */}
            {audioBlocked && isRinging && (
              <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-900">
                <span className="flex items-center gap-1.5">
                  <VolumeX className="w-4 h-4 shrink-0 text-amber-700" />
                  Browser paused alarm audio until interaction.
                </span>
                <button
                  type="button"
                  onClick={() => void unlockAudioManually()}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 shrink-0 inline-flex items-center gap-1"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Enable Sound
                </button>
              </div>
            )}

            {/* Action Buttons: Stop, Snooze (5m), Dismiss, Complete */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
              {(isRinging || isBlinking) && (
                <button
                  type="button"
                  onClick={stopActiveAlert}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Stop
                </button>
              )}

              <button
                type="button"
                onClick={() => void snoozeReminder(current, SNOOZE_MINUTES)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
              >
                <AlarmClock className="w-3.5 h-3.5" />
                Snooze {SNOOZE_MINUTES}m
              </button>

              <button
                type="button"
                onClick={() => void dismissReminder(current)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>

              {!current.isTest && (
                <button
                  type="button"
                  onClick={() => void completeReminder(current)}
                  className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
};

