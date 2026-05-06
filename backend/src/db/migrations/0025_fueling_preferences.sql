ALTER TABLE "pulse_user_profile"
  ADD COLUMN IF NOT EXISTS "fueling_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "dietary_constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "preferred_fueling_products" TEXT NOT NULL DEFAULT 'Ministry',
  ADD COLUMN IF NOT EXISTS "carb_guidance_style" VARCHAR(32) NOT NULL DEFAULT 'suggest_ranges',
  ADD COLUMN IF NOT EXISTS "sodium_guidance_style" VARCHAR(32) NOT NULL DEFAULT 'suggest_ranges',
  ADD COLUMN IF NOT EXISTS "body_weight_guidance_enabled" BOOLEAN NOT NULL DEFAULT true;
