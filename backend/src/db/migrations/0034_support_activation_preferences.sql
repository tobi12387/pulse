ALTER TABLE "pulse_coach_preferences"
  ADD COLUMN IF NOT EXISTS "support_warning_signs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "support_stabilizing_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "support_contact_note" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "support_activation_preference" VARCHAR(32) NOT NULL DEFAULT 'suggest_only';
