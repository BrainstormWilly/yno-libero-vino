-- Fix CRM sync queue to handle HTTP timeouts gracefully
-- The current implementation hangs indefinitely on http_collect_response

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
  v_response_id BIGINT;
  v_response_status INTEGER;
  v_response_body JSONB;
  v_error_msg TEXT;
  v_next_retry TIMESTAMP WITH TIME ZONE;
  v_request_body JSONB;
  v_club_id TEXT;
  v_old_club_id TEXT;
  v_membership_id TEXT;
  v_wait_attempts INTEGER;
BEGIN
  -- Get API base URL from environment (our API endpoint)
  -- PRODUCTION: Override with ALTER DATABASE postgres SET app.api_base_url = 'https://your-production-domain.com';
  v_api_base_url := COALESCE(
    current_setting('app.api_base_url', true),
    'https://c7-kindly-balanced-macaw.ngrok-free.app'  -- Static Ngrok URL for dev (paid plan)
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

      -- Get enrollment info if available (for membership ID)
      IF v_job.enrollment_id IS NOT NULL THEN
        SELECT ce.* INTO v_enrollment
        FROM club_enrollments ce
        WHERE ce.id = v_job.enrollment_id;
      END IF;

      -- Determine club/membership IDs based on CRM type
      IF v_client.crm_type = 'commerce7' THEN
        -- Commerce7: Use club_id from stage (nullable - required for membership operations)
        v_club_id := v_stage.c7_club_id;
        
        -- Get membership ID from enrollment if available (for cancellations)
        IF v_enrollment.id IS NOT NULL THEN
          v_membership_id := v_enrollment.c7_membership_id;
        END IF;
        
        -- Only require club_id for upgrade operations, not cancellations
        -- add_membership is never queued (happens in UI, must succeed immediately)
        IF v_club_id IS NULL AND v_job.action_type = 'upgrade_membership' THEN
          RAISE EXCEPTION 'Commerce7 club_id not found for stage % (required for upgrade_membership operation)', v_job.stage_id;
        END IF;
      ELSE
        -- Shopify: We'll handle promotions in the API endpoint
        -- For now, pass NULL and let API endpoint look up promotions from club_stage_promotions
        v_club_id := NULL;
        v_membership_id := NULL;
      END IF;

      -- Build request body for our API endpoint
      v_request_body := jsonb_build_object(
        'queueId', v_job.id::TEXT,
        'clientId', v_client.id::TEXT,
        'actionType', v_job.action_type,
        'crmType', v_client.crm_type,
        'tenantShop', v_client.tenant_shop,
        'stageId', v_stage.id::TEXT,
        'clubId', v_club_id,  -- Commerce7 club ID, NULL for Shopify
        'membershipId', v_membership_id,  -- Commerce7 membership ID for cancellations
        'customerCrmId', v_job.customer_crm_id
      );

      -- Add old_stage info if this is an upgrade
      IF v_job.action_type = 'upgrade_membership' AND v_job.old_stage_id IS NOT NULL THEN
        SELECT cs.* INTO v_old_stage
        FROM club_stages cs
        WHERE cs.id = v_job.old_stage_id;

        IF FOUND THEN
          -- Get old club ID
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

      -- Call our API endpoint via pg_net with timeout
      -- Set a 30 second timeout for the HTTP request
      RAISE NOTICE 'Making HTTP POST to % with body: %', v_api_base_url || '/api/cron/sync', v_request_body::text;
      
      v_request_id := net.http_post(
        v_api_base_url || '/api/cron/sync',  -- url
        v_request_body,                      -- body (jsonb)
        '{}'::jsonb,                         -- params (empty)
        jsonb_build_object(                  -- headers
          'Content-Type', 'application/json',
          'User-Agent', 'pg_net-cron-processor'
        ),
        30000  -- timeout in milliseconds (30 seconds)
      );
      
      RAISE NOTICE 'HTTP POST initiated with request ID: %', v_request_id;

      -- Wait for response with polling and timeout
      -- Try up to 10 times (10 seconds total) before giving up
      v_wait_attempts := 0;
      v_response_id := NULL;
      
      RAISE NOTICE 'Waiting for HTTP response...';
      
      WHILE v_wait_attempts < 10 AND v_response_id IS NULL LOOP
        -- Wait 1 second
        PERFORM pg_sleep(1);
        v_wait_attempts := v_wait_attempts + 1;
        
        RAISE NOTICE 'Attempt % of 10: collecting response...', v_wait_attempts;
        
        -- Try to collect response
        PERFORM net.http_collect_response(v_request_id, false);
        
        -- Check if response is available
        SELECT 
          id,
          status_code,
          content::jsonb,
          error_msg
        INTO 
          v_response_id,
          v_response_status,
          v_response_body,
          v_error_msg
        FROM net._http_response
        WHERE id = v_request_id;
        
        -- If we got a response (success or error), break the loop
        IF v_response_id IS NOT NULL THEN
          RAISE NOTICE 'Response received! Status: %, Body: %', v_response_status, v_response_body::text;
          EXIT;
        END IF;
      END LOOP;

      -- Check if we got a response
      IF v_response_id IS NULL THEN
        -- Request timed out - mark for retry
        RAISE EXCEPTION 'HTTP request timed out after 10 seconds (request ID: %)', v_request_id;
      END IF;
      
      -- Check for HTTP-level errors (pg_net timeout, connection refused, etc)
      IF v_error_msg IS NOT NULL THEN
        RAISE EXCEPTION 'HTTP request error: %', v_error_msg;
      END IF;

      -- Check response status
      IF v_response_status != 200 THEN
        v_error_msg := COALESCE(
          v_response_body->>'error',
          v_response_body->>'message',
          'HTTP ' || v_response_status::TEXT
        );
        RAISE EXCEPTION 'API endpoint error: %', v_error_msg;
      END IF;

      -- Check if the API returned success
      IF v_response_body->>'success' = 'false' OR (v_response_body->>'success')::boolean = false THEN
        v_error_msg := COALESCE(
          v_response_body->>'error',
          v_response_body->>'message',
          'Unknown error from API'
        );
        RAISE EXCEPTION 'Sync failed: %', v_error_msg;
      END IF;

      -- Mark as completed
      UPDATE crm_sync_queue
      SET 
        status = 'completed',
        error_message = NULL,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = v_job.id;

      v_success := v_success + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Handle errors - retry with exponential backoff
        v_errors := v_errors + 1;
        
        -- Calculate next retry time (exponential backoff: 2^attempts minutes)
        v_next_retry := NOW() + (POWER(2, v_job.attempts) || ' minutes')::INTERVAL;

        -- Update queue with error
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
        
        -- Log the error but continue processing other jobs
        RAISE NOTICE 'Error processing job %: %', v_job.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_success, v_errors;
END;
$$;

COMMENT ON FUNCTION process_crm_sync_queue() IS 'Processes pending CRM sync queue items by calling our API endpoint via pg_net with 30-second timeout. Handles cancel_membership (from cron expirations) and upgrade_membership (from background webhooks). add_membership is never queued - it happens in UI and must succeed immediately. Commerce7 uses clubs, Shopify uses promotions.';

