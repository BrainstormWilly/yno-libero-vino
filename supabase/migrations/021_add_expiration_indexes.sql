-- Index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_club_enrollments_status_expires 
ON club_enrollments(status, expires_at) 
WHERE status = 'active';

COMMENT ON INDEX idx_club_enrollments_status_expires IS 'Optimizes queries for finding expired active enrollments';

