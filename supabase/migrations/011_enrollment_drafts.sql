-- Create enrollment_drafts table to store in-progress member enrollments
CREATE TABLE IF NOT EXISTS enrollment_drafts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id text UNIQUE NOT NULL,
  customer_data jsonb,
  tier_data jsonb,
  address_verified boolean DEFAULT false,
  payment_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS enrollment_drafts_session_id_idx ON enrollment_drafts(session_id);

-- Add comment
COMMENT ON TABLE enrollment_drafts IS 'Temporary storage for in-progress member enrollment data';

