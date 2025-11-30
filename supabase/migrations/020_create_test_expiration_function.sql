-- Function to manually test expiration processing
-- This can be called directly for testing purposes
CREATE OR REPLACE FUNCTION test_process_expired_enrollments()
RETURNS TABLE(processed_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM process_expired_enrollments();
END;
$$;

COMMENT ON FUNCTION test_process_expired_enrollments() IS 'Manual test function for expiration processing - returns same results as scheduled job';

