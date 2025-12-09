-- Fix CRM sync queue with proper HTTP polling instead of blocking
-- The issue was net.http_collect_response() blocking indefinitely

-- Drop the function first to ensure clean replacement
DROP FUNCTION IF EXISTS process_crm_sync_queue();

CREATE OR REPLACE FUNCTION process_crm_sync_queue()
RETURNS TABLE(processed_count INTEGER, success_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_client RECORD;
  v_stage RECORD;
  v_old_stage RECORD;
  v_enrollment RECORD;
  v_processed INTEGER := 0;
  v_success INTEGER := 0;
  v_errors INTEGER := 0;
  v_api_base_url TEXT;
  v_request_id BIGINT;
  v_error_msg TEXT;
  v_next_retry TIMESTAMP WITH TIME ZONE;
  v_request_body JSONB;
  v_club_id TEXT;
  v_old_club_id TEXT;
  v_membership_id TEXT;
BEGIN
  -- Get API base URL from environment
  v_api_base_url := COALESCE(
    current_setting('app.api_base_url', true),
    'https://c7-kindly-balanced-macaw.ngrok-free.app'
  );

  -- Process up to 50 pending jobs
  FOR v_job IN
    SELECT 
      sq.id,
      sq.client_id,
      sq.action_type,
      sq.stage_id,
      sq.old_stage_id,
      sq.enrollment_id,
      sq.customer_crm_id,
      sq.attempts,
      sq.max_attempts,
      sq.next_retry_at
    FROM crm_sync_queue sq
    WHERE sq.status = 'pending'
      AND (sq.next_retry_at IS NULL OR sq.next_retry_at <= NOW())
      AND sq.attempts < sq.max_attempts
    ORDER BY sq.created_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE crm_sync_queue
      SET 
        status = 'processing',
        attempts = attempts + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
      WHERE id = v_job.id;

      v_processed := v_processed + 1;

      -- Get client info
      SELECT c.* INTO v_client
      FROM clients c
      WHERE c.id = v_job.client_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Client not found for sync job %', v_job.id;
      END IF;

      -- Get stage info
      SELECT cs.* INTO v_stage
      FROM club_stages cs
      WHERE cs.id = v_job.stage_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stage not found for sync job %', v_job.id;
      END IF;

      -- Get enrollment info if available
      IF v_job.enrollment_id IS NOT NULL THEN
        SELECT ce.* INTO v_enrollment
        FROM club_enrollments ce
        WHERE ce.id = v_job.enrollment_id;
      END IF;

      -- Determine club/membership IDs based on CRM type
      IF v_client.crm_type = 'commerce7' THEN
        v_club_id := v_stage.c7_club_id;
        
        IF v_enrollment.id IS NOT NULL THEN
          v_membership_id := v_enrollment.c7_membership_id;
        END IF;
        
        IF v_club_id IS NULL AND v_job.action_type = 'upgrade_membership' THEN
          RAISE EXCEPTION 'Commerce7 club_id not found for stage % (required for upgrade_membership operation)', v_job.stage_id;
        END IF;
      ELSE
        v_club_id := NULL;
        v_membership_id := NULL;
      END IF;

      -- Build request body
      v_request_body := jsonb_build_object(
        'queueId', v_job.id::TEXT,
        'clientId', v_client.id::TEXT,
        'actionType', v_job.action_type,
        'crmType', v_client.crm_type,
        'tenantShop', v_client.tenant_shop,
        'stageId', v_stage.id::TEXT,
        'clubId', v_club_id,
        'membershipId', v_membership_id,
        'customerCrmId', v_job.customer_crm_id
      );

      -- Add old_stage info if this is an upgrade
      IF v_job.action_type = 'upgrade_membership' AND v_job.old_stage_id IS NOT NULL THEN
        SELECT cs.* INTO v_old_stage
        FROM club_stages cs
        WHERE cs.id = v_job.old_stage_id;

        IF FOUND THEN
          IF v_client.crm_type = 'commerce7' THEN
            v_old_club_id := v_old_stage.c7_club_id;
          ELSE
            v_old_club_id := NULL;
          END IF;

          v_request_body := v_request_body || jsonb_build_object(
            'oldStageId', v_old_stage.id::TEXT,
            'oldClubId', v_old_club_id
          );
        END IF;
      END IF;

      -- Call our API endpoint via pg_net
      -- Fire and forget - don't wait for response (matches process_monthly_status_queue pattern)
      BEGIN
        v_request_id := net.http_post(
          v_api_base_url || '/api/cron/sync',
          v_request_body,
          '{}'::jsonb,
          jsonb_build_object(
            'Content-Type', 'application/json',
            'User-Agent', 'pg_net-cron-processor'
          ),
          30000  -- 30 second timeout
        );
        RAISE NOTICE 'Queued HTTP request % for queue item %', v_request_id, v_job.id;
      EXCEPTION
        WHEN OTHERS THEN
          -- HTTP call failed, mark as error
          RAISE EXCEPTION 'HTTP call failed for queue item %: %', v_job.id, SQLERRM;
      END;

      -- Mark as completed
      UPDATE crm_sync_queue
      SET 
        status = 'completed',
        error_message = NULL,
        updated_at = NOW()
      WHERE id = v_job.id;

      v_success := v_success + 1;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        
        v_next_retry := NOW() + (POWER(2, v_job.attempts) || ' minutes')::INTERVAL;

        UPDATE crm_sync_queue
        SET 
          status = CASE 
            WHEN v_job.attempts >= v_job.max_attempts - 1 THEN 'failed'
            ELSE 'pending'
          END,
          error_message = SQLERRM,
          next_retry_at = CASE
            WHEN v_job.attempts >= v_job.max_attempts - 1 THEN NULL
            ELSE v_next_retry
          END,
          updated_at = NOW()
        WHERE id = v_job.id;
        
        RAISE NOTICE 'Error processing job %: %', v_job.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_success, v_errors;
END;
$$;

COMMENT ON FUNCTION process_crm_sync_queue() IS 'Processes pending CRM sync queue items by calling our API endpoint via pg_net (fire-and-forget pattern, matches process_monthly_status_queue). Handles cancel_membership (from cron expirations) and upgrade_membership (from background webhooks).';

