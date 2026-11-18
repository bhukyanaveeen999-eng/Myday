-- Migration: 20261118141246_add_notes_pin_and_category.sql
-- Description: Add pinned status and category organization to public.notes

ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_notes_user_pinned_updated
    ON public.notes(user_id, is_pinned DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_user_category
    ON public.notes(user_id, category);

