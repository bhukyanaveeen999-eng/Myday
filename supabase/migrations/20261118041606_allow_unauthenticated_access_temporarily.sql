-- Migration: 20261118041606_allow_unauthenticated_access_temporarily.sql
-- Description: Temporarily allow unauthenticated CRUD on tasks and notes (rows where user_id IS NULL)
--              while authentication is disabled during early development.
--              Existing authenticated RLS policies (auth.uid() = user_id) remain intact so auth can be re-enabled cleanly later.

-- 1. Allow NULL user_id temporarily on tasks and notes
ALTER TABLE public.tasks ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.notes ALTER COLUMN user_id DROP NOT NULL;

-- 2. Temporary RLS policies for unauthenticated tasks (scoped strictly to user_id IS NULL)
CREATE POLICY "TEMP: Allow unauthenticated view of public tasks"
    ON public.tasks
    FOR SELECT
    USING (user_id IS NULL);

CREATE POLICY "TEMP: Allow unauthenticated insert of public tasks"
    ON public.tasks
    FOR INSERT
    WITH CHECK (user_id IS NULL);

CREATE POLICY "TEMP: Allow unauthenticated update of public tasks"
    ON public.tasks
    FOR UPDATE
    USING (user_id IS NULL)
    WITH CHECK (user_id IS NULL);

CREATE POLICY "TEMP: Allow unauthenticated delete of public tasks"
    ON public.tasks
    FOR DELETE
    USING (user_id IS NULL);

-- 3. Temporary RLS policies for unauthenticated notes (scoped strictly to user_id IS NULL)
CREATE POLICY "TEMP: Allow unauthenticated view of public notes"
    ON public.notes
    FOR SELECT
    USING (user_id IS NULL);

CREATE POLICY "TEMP: Allow unauthenticated insert of public notes"
    ON public.notes
    FOR INSERT
    WITH CHECK (user_id IS NULL);

CREATE POLICY "TEMP: Allow unauthenticated update of public notes"
    ON public.notes
    FOR UPDATE
    USING (user_id IS NULL)
    WITH CHECK (user_id IS NULL);

CREATE POLICY "TEMP: Allow unauthenticated delete of public notes"
    ON public.notes
    FOR DELETE
    USING (user_id IS NULL);

