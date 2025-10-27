-- ================================================================
-- Migration: Add external user mapping for microservice integration
-- Version: 018
-- Description: Add external_user_id column to profiles table for
--              mapping users from external Supabase Auth projects
-- ================================================================

-- Add external_user_id column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS external_user_id TEXT;

-- Add unique constraint to prevent duplicate external user mappings
ALTER TABLE profiles
ADD CONSTRAINT profiles_external_user_id_unique
UNIQUE (external_user_id);

-- Create index for fast lookup by external user ID
CREATE INDEX IF NOT EXISTS idx_profiles_external_user_id
ON profiles(external_user_id)
WHERE external_user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.external_user_id IS
'External user ID from connected microservices (e.g., order system, measurement system). Used for mapping users from separate Supabase Auth projects.';

-- Add audit log entry
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    INSERT INTO audit_logs (
      actor_user_id,
      entity,
      action,
      entity_id,
      diff
    ) VALUES (
      NULL,
      'profiles',
      'schema_migration',
      NULL,
      jsonb_build_object(
        'migration', '018_add_external_user_mapping',
        'description', 'Added external_user_id column for microservice user mapping',
        'changes', jsonb_build_array(
          'Added external_user_id TEXT column',
          'Added unique constraint on external_user_id',
          'Created index idx_profiles_external_user_id'
        )
      )
    );
  END IF;
END $$;
