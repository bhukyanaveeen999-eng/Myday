
-- Migration: 20261118060025_restore_strict_auth_rls.sql
-- Description: Remove temporary unauthenticated access policies and restore strict
--              per-user Row Level Security (auth.uid() = user_id) on tasks and notes.

-- 1. Drop temporary unauthenticated policies on public.tasks
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated view of public tasks" ON public.tasks;
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated insert of public tasks" ON public.tasks;
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated update of public tasks" ON public.tasks;
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated delete of public tasks" ON public.tasks;

-- 2. Drop temporary unauthenticated policies on public.notes
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated view of public notes" ON public.notes;
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated insert of public notes" ON public.notes;
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated update of public notes" ON public.notes;
DROP POLICY IF EXISTS "TEMP: Allow unauthenticated delete of public notes" ON public.notes;

-- 3. Ensure Row Level Security remains strictly enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
