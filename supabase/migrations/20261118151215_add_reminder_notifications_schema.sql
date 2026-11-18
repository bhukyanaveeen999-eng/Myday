-- Migration: 20261118151215_add_reminder_notifications_schema.sql
-- Description: Add reminder snooze/dismissal tracking on tasks, per-user notification_preferences,
--              multi-device push_subscriptions, and reminder_delivery_logs for Web Push deduplication.

-- 1. Extend existing public.tasks with reminder state (no duplicate reminders table)
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tasks_due_reminders
    ON public.tasks(status, reminder_dismissed, scheduled_at, snoozed_until)
    WHERE status = 'pending' AND reminder_dismissed = FALSE;

-- 2. User Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    mode TEXT NOT NULL DEFAULT 'both' CHECK (mode IN ('ring', 'blink', 'both', 'silent')),
    sound TEXT NOT NULL DEFAULT 'chime' CHECK (sound IN ('chime', 'bell', 'pulse', 'gentle')),
    volume REAL NOT NULL DEFAULT 0.75 CHECK (volume >= 0 AND volume <= 1),
    browser_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS set_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
    ON public.notification_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
    ON public.notification_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
    ON public.notification_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
    ON public.notification_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Multi-Device Web Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
    ON public.push_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
    ON public.push_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
    ON public.push_subscriptions
    FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Server-Side Reminder Delivery Deduplication Logs
CREATE TABLE IF NOT EXISTS public.reminder_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    channel TEXT NOT NULL DEFAULT 'web_push',
    status TEXT NOT NULL DEFAULT 'sent',
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (task_id, scheduled_for, channel)
);

CREATE INDEX IF NOT EXISTS idx_reminder_delivery_logs_user_id
    ON public.reminder_delivery_logs(user_id, delivered_at DESC);

ALTER TABLE public.reminder_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder delivery logs"
    ON public.reminder_delivery_logs
    FOR SELECT
    USING (auth.uid() = user_id);

