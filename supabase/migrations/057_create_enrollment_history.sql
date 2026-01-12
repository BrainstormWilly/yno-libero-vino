-- Create enrollment_history table
-- Tracks all changes to club enrollments for ROI metrics
-- Enables tracking of upgrades, downgrades, extensions, and status changes

CREATE TYPE enrollment_change_type AS ENUM ('upgrade', 'downgrade', 'extension', 'status_change');

CREATE TABLE enrollment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES club_enrollments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  change_type enrollment_change_type NOT NULL,
  old_club_stage_id UUID REFERENCES club_stages(id),
  new_club_stage_id UUID REFERENCES club_stages(id),
  old_expires_at TIMESTAMP WITH TIME ZONE,
  new_expires_at TIMESTAMP WITH TIME ZONE,
  old_status TEXT,
  new_status TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  
  -- Ensure we have at least one change tracked
  CHECK (
    old_club_stage_id IS DISTINCT FROM new_club_stage_id OR
    old_expires_at IS DISTINCT FROM new_expires_at OR
    old_status IS DISTINCT FROM new_status
  )
);

-- Add indexes for common queries
CREATE INDEX idx_enrollment_history_enrollment_id ON enrollment_history(enrollment_id);
CREATE INDEX idx_enrollment_history_customer_id ON enrollment_history(customer_id);
CREATE INDEX idx_enrollment_history_client_id ON enrollment_history(client_id);
CREATE INDEX idx_enrollment_history_changed_at ON enrollment_history(changed_at);
CREATE INDEX idx_enrollment_history_change_type ON enrollment_history(change_type);
CREATE INDEX idx_enrollment_history_customer_changed ON enrollment_history(customer_id, changed_at);

-- Add comments for documentation
COMMENT ON TABLE enrollment_history IS 'Tracks all changes to club enrollments for ROI metrics. Records upgrades, downgrades, extensions, and status changes.';
COMMENT ON COLUMN enrollment_history.change_type IS 'Type of change: upgrade (tier increased), downgrade (tier decreased), extension (expires_at increased), status_change (status changed)';
COMMENT ON COLUMN enrollment_history.metadata IS 'Additional context about the change (e.g., source, reason, etc.)';
