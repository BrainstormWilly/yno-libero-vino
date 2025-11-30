-- ============================================
-- Queue Monthly Status Jobs Function
-- ============================================
-- This function queues monthly status notifications for all active members
-- Called by the monthly cron job (1st of each month at 9 AM)
-- It creates queue entries instead of processing immediately

CREATE OR REPLACE FUNCTION queue_monthly_status_jobs()
RETURNS TABLE(
  queued_count INTEGER,
  skipped_count INTEGER
) AS $$
DECLARE
  client_record RECORD;
  customer_record RECORD;
  v_queued_total INTEGER := 0;
  v_skipped_total INTEGER := 0;
  v_temp INTEGER;
BEGIN
  -- Loop through all clients with monthly status enabled
  FOR client_record IN
    SELECT c.id, c.org_name
    FROM clients c
    INNER JOIN communication_configs cc ON cc.client_id = c.id
    WHERE c.is_active = true
      AND cc.send_monthly_status = true
  LOOP
    BEGIN
      -- Queue all active club members for this client
      FOR customer_record IN
        SELECT cu.id
        FROM customers cu
        WHERE cu.client_id = client_record.id
          AND cu.is_club_member = true
      LOOP
        BEGIN
          -- Check if notification already exists for this customer this month
          -- (using the unique index to prevent duplicates)
          IF NOT EXISTS (
            SELECT 1 FROM monthly_status_queue
            WHERE client_id = client_record.id
              AND customer_id = customer_record.id
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
          ) THEN
            -- Insert into queue
            INSERT INTO monthly_status_queue (
              client_id,
              customer_id,
              status,
              created_at
            ) VALUES (
              client_record.id,
              customer_record.id,
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
            RAISE WARNING 'Error queueing monthly status for customer % in client % (%): %',
              customer_record.id,
              client_record.id,
              client_record.org_name,
              SQLERRM;
        END;
      END LOOP;
      
      RAISE NOTICE 'Queued monthly status jobs for client % (%), queued: %, skipped: %',
        client_record.id,
        client_record.org_name,
        v_queued_total,
        v_skipped_total;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Exception queueing monthly status for client % (%): %',
          client_record.id,
          client_record.org_name,
          SQLERRM;
    END;
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT v_queued_total, v_skipped_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION queue_monthly_status_jobs() IS 'Queues monthly status notification jobs for all active club members of clients with monthly status enabled. Called by the monthly cron job on the 1st of each month.';

