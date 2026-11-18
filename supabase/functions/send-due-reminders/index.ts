// Supabase Edge Function: send-due-reminders
// Purpose: Server-side scheduled reminder delivery via Web Push API when the browser or PWA is closed.
// Deploy: npx supabase functions deploy send-due-reminders --no-verify-jwt
// Secrets required (set via `npx supabase secrets set`):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT
//   REMINDER_CRON_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const MAX_BATCH_SIZE = 50;
const MISSED_WINDOW_MS = 24 * 60 * 60 * 1000;

interface DueTaskRow {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  snoozed_until: string | null;
  timezone: string;
}

interface PrefRow {
  user_id: string;
  enabled: boolean;
  mode: 'ring' | 'blink' | 'both' | 'silent';
  push_enabled: boolean;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function formatDueTime(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone || 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

Deno.serve(async (req: Request) => {
  try {
    // Enforce shared secret header so only authorized cron / admin callers can invoke this function
    const cronSecret = Deno.env.get('REMINDER_CRON_SECRET');
    if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@myday-app.local';

    if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({
          error:
            'Missing required Edge Function environment secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - MISSED_WINDOW_MS).toISOString();

    // 1. Fetch a manageable batch of pending, non-dismissed due tasks
    const { data: tasks, error: tasksErr } = await supabase
      .from('tasks')
      .select('id, user_id, title, description, scheduled_at, snoozed_until, timezone')
      .eq('status', 'pending')
      .eq('reminder_dismissed', false)
      .not('user_id', 'is', null)
      .or(`snoozed_until.lte.${nowIso},and(snoozed_until.is.null,scheduled_at.lte.${nowIso})`)
      .order('scheduled_at', { ascending: true })
      .limit(MAX_BATCH_SIZE);

    if (tasksErr) throw tasksErr;

    const dueTasks = ((tasks as DueTaskRow[]) || []).filter((t) => {
      const dueIso = t.snoozed_until || t.scheduled_at;
      return Boolean(dueIso && dueIso >= cutoffIso && dueIso <= nowIso);
    });

    if (dueTasks.length === 0) {
      return new Response(
        JSON.stringify({ checked: 0, sent: 0, skipped: 0, cleanedSubscriptions: 0, errors: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userIds = Array.from(
      new Set(dueTasks.map((t) => t.user_id).filter(Boolean) as string[])
    );

    const [{ data: prefs }, { data: subs }] = await Promise.all([
      supabase
        .from('notification_preferences')
        .select('user_id, enabled, mode, push_enabled')
        .in('user_id', userIds),
      supabase
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth')
        .in('user_id', userIds),
    ]);

    const prefByUser = new Map<string, PrefRow>();
    for (const p of (prefs as PrefRow[]) || []) {
      prefByUser.set(p.user_id, p);
    }

    const subsByUser = new Map<string, SubscriptionRow[]>();
    for (const s of (subs as SubscriptionRow[]) || []) {
      const list = subsByUser.get(s.user_id) || [];
      list.push(s);
      subsByUser.set(s.user_id, list);
    }

    let sentCount = 0;
    let skippedCount = 0;
    let cleanedSubscriptions = 0;
    let errorCount = 0;

    for (const task of dueTasks) {
      try {
        if (!task.user_id) {
          skippedCount++;
          continue;
        }
        const effectiveDueIso = task.snoozed_until || task.scheduled_at;
        if (!effectiveDueIso) {
          skippedCount++;
          continue;
        }

        const userPref = prefByUser.get(task.user_id);
        if (userPref && (!userPref.enabled || !userPref.push_enabled)) {
          skippedCount++;
          continue;
        }

        const userSubs = subsByUser.get(task.user_id) || [];
        if (userSubs.length === 0) {
          skippedCount++;
          continue;
        }

        // Phase 1: Atomically claim this (task_id, scheduled_for, 'web_push') slot as 'processing'
        // to prevent overlapping cron runs from double-sending.
        const { data: claimRow, error: claimErr } = await supabase
          .from('reminder_delivery_logs')
          .insert({
            task_id: task.id,
            user_id: task.user_id,
            scheduled_for: effectiveDueIso,
            channel: 'web_push',
            status: 'processing',
          })
          .select('id')
          .single();

        if (claimErr || !claimRow) {
          // Already processing or already delivered for this exact scheduled occurrence
          skippedCount++;
          continue;
        }

        const mode = userPref?.mode || 'both';
        const silent = mode === 'silent' || mode === 'blink';
        const dueLabel = formatDueTime(task.scheduled_at || effectiveDueIso, task.timezone);

        const bodyParts = [
          task.description ? task.description : '',
          `Scheduled: ${dueLabel}`,
        ].filter(Boolean);

        const payload = JSON.stringify({
          taskId: task.id,
          title: `Reminder: ${task.title}`,
          description: task.description,
          body: bodyParts.join(' — '),
          scheduledAt: task.scheduled_at || effectiveDueIso,
          mode,
          silent,
          vibrate: silent ? [] : [220, 120, 220],
          url: `/tasks?reminder=${encodeURIComponent(task.id)}`,
        });

        let taskDeliveredCount = 0;

        for (const sub of userSubs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload,
              { TTL: 3600, urgency: silent ? 'normal' : 'high' }
            );
            taskDeliveredCount++;
            sentCount++;
          } catch (pushErr: unknown) {
            errorCount++;
            const statusCode = (pushErr as { statusCode?: number })?.statusCode;
            // Clean up expired or revoked browser push subscriptions automatically
            if (statusCode === 404 || statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
              cleanedSubscriptions++;
            }
          }
        }

        // Phase 2: Mark as 'sent' ONLY after at least one device push succeeded.
        // If all deliveries failed transiently, release the claim so the next cron run can retry.
        if (taskDeliveredCount > 0) {
          await supabase
            .from('reminder_delivery_logs')
            .update({ status: 'sent', delivered_at: new Date().toISOString() })
            .eq('id', claimRow.id);
        } else {
          await supabase.from('reminder_delivery_logs').delete().eq('id', claimRow.id);
        }
      } catch {
        // Isolate per-reminder errors so one failure never halts the batch
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        checked: dueTasks.length,
        sent: sentCount,
        skipped: skippedCount,
        cleanedSubscriptions,
        errors: errorCount,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
