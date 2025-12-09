-- ============================================
-- Queue Expiration Warning Jobs Function
-- ============================================
-- This function queues expiration warning notifications for memberships expiring soon
-- Called by the daily cron job (daily at 10 AM)
-- It creates queue entries for memberships expiring within the warning period

CREATE OR REPLACE FUNCTION queue_expiration_warning_jobs()
RETURNS TABLE(
  queued_count INTEGER,
  skipped_count INTEGER
) AS $$
DECLARE
  client_record RECORD;
  enrollment_record RECORD;
  v_queued_total INTEGER := 0;
  v_skipped_total INTEGER := 0;
  v_temp INTEGER;
  v_warning_days INTEGER;
  v_warning_date DATE;
BEGIN
  -- Loop through all clients with expiration warnings enabled
  FOR client_record IN
    SELECT c.id, c.org_name, cc.send_expiration_warnings, COALESCE(cc.warning_days_before, 7) as warning_days
    FROM clients c
    INNER JOIN communication_configs cc ON cc.client_id = c.id
    WHERE cc.send_expiration_warnings = true
  LOOP
    BEGIN
      v_warning_days := client_record.warning_days;
      v_warning_date := CURRENT_DATE + (v_warning_days || ' days')::INTERVAL;
      
      -- Find enrollments expiring within the warning period
      FOR enrollment_record IN
        SELECT 
          ce.id as enrollment_id,
          ce.customer_id,
          cu.client_id,
          ce.expires_at
        FROM club_enrollments ce
        INNER JOIN customers cu ON cu.id = ce.customer_id
        WHERE cu.client_id = client_record.id
          AND ce.status = 'active'
          AND cu.is_club_member = true
          -- Expires within warning period (exactly X days from now)
          AND DATE(ce.expires_at) = v_warning_date
      LOOP
        BEGIN
          -- Check if warning already exists for this enrollment this month
          -- (using the unique index to prevent duplicates)
          IF NOT EXISTS (
            SELECT 1 FROM expiration_warning_queue
            WHERE enrollment_id = enrollment_record.enrollment_id
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
          ) THEN
            -- Insert into queue
            INSERT INTO expiration_warning_queue (
              client_id,
              customer_id,
              enrollment_id,
              status,
              created_at
            ) VALUES (
              enrollment_record.client_id,
              enrollment_record.customer_id,
              enrollment_record.enrollment_id,
              'pending',
              NOW()
            );
            v_queued_total := v_queued_total + 1;
          ELSE
            v_skipped_total := v_skipped_total + 1;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            -- Log but continue
            RAISE WARNING 'Error queueing expiration warning for enrollment % in client % (%): %',
              enrollment_record.enrollment_id,
              client_record.id,
              client_record.org_name,
              SQLERRM;
        END;
      END LOOP;
      
      RAISE NOTICE 'Queued expiration warning jobs for client % (%), queued: %, skipped: %',
        client_record.id,
        client_record.org_name,
        v_queued_total,
        v_skipped_total;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Exception queueing expiration warnings for client % (%): %',
          client_record.id,
          client_record.org_name,
          SQLERRM;
    END;
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT v_queued_total, v_skipped_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION queue_expiration_warning_jobs() IS 'Queues expiration warning notification jobs for active enrollments expiring within the configured warning period (default 7 days). Called by the daily cron job at 10 AM.';

