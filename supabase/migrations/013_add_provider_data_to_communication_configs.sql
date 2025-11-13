-- Add provider_data column to communication_configs for provider-specific metadata
ALTER TABLE communication_configs
ADD COLUMN IF NOT EXISTS provider_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Ensure updated_at is bumped when provider_data changes
CREATE OR REPLACE FUNCTION set_communication_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_communication_configs_updated_at ON communication_configs;

CREATE TRIGGER set_communication_configs_updated_at
BEFORE UPDATE ON communication_configs
FOR EACH ROW
EXECUTE FUNCTION set_communication_configs_updated_at();
