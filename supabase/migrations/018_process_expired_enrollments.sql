CREATE OR REPLACE FUNCTION process_expired_enrollments()
RETURNS TABLE(processed_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
  v_enrollment RECORD;
BEGIN
  -- Find all active enrollments that have expired
  FOR v_enrollment IN
    SELECT 
      ce.id,
      ce.customer_id,
      ce.club_stage_id,
      ce.synced_to_crm,
      cs.crm_discount_id,
      c.crm_id,
      c.client_id
    FROM club_enrollments ce
    INNER JOIN club_stages cs ON ce.club_stage_id = cs.id
    INNER JOIN customers c ON ce.customer_id = c.id
    WHERE ce.status = 'active'
      AND ce.expires_at < NOW()
  LOOP
    BEGIN
      -- Mark enrollment as expired
      UPDATE club_enrollments
      SET 
        status = 'expired',
        updated_at = NOW()
      WHERE id = v_enrollment.id;

      -- Check if customer has any other active enrollments
      IF NOT EXISTS (
        SELECT 1 
        FROM club_enrollments 
        WHERE customer_id = v_enrollment.customer_id 
          AND status = 'active'
      ) THEN
        -- No other active enrollments - update customer flags
        UPDATE customers
        SET 
          is_club_member = false,
          loyalty_earning_active = false,
          updated_at = NOW()
        WHERE id = v_enrollment.customer_id;
      END IF;

      -- Queue CRM sync if enrollment was synced to CRM
      IF v_enrollment.synced_to_crm 
         AND v_enrollment.crm_discount_id IS NOT NULL 
         AND v_enrollment.crm_id IS NOT NULL THEN
        INSERT INTO crm_sync_queue (
          client_id,
          enrollment_id,
          action_type,
          stage_id,
          customer_crm_id,
          status,
          created_at
        ) VALUES (
          v_enrollment.client_id,
          v_enrollment.id,
          'remove_customer', -- Will be updated to 'cancel_membership' by migration 026
          v_enrollment.club_stage_id,
          v_enrollment.crm_id,
          'pending',
          NOW()
        )
        ON CONFLICT DO NOTHING; -- Prevent duplicate queue entries
      END IF;

      v_processed := v_processed + 1;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        -- Log error (could insert into error log table if needed)
        RAISE WARNING 'Error processing enrollment %: %', v_enrollment.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_errors;
END;
$$;

COMMENT ON FUNCTION process_expired_enrollments() IS 'Processes expired club enrollments, updates customer flags, and queues membership cancellations for CRM sync. Note: New memberships come from order webhooks, not cron jobs.';

