-- Function to process CRM sync queue using pg_net to call our API endpoints
-- Our API endpoints handle the actual CRM API calls (they have access to env vars)
-- This keeps credentials secure and leverages existing CRM provider code

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
BEGIN
  -- Get API base URL from environment (our API endpoint)
  -- Default to localhost for development, should be set to production URL
  v_api_base_url := COALESCE(
    current_setting('app.api_base_url', true),
    'http://localhost:5173'  -- Default for local dev
  );

  -- Process up to 50 pending jobs
  FOR v_job IN
    SELECT 
      sq.id,
      sq.client_id,
      sq.action_type,
      sq.stage_id,
      sq.old_stage_id,
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

      -- Get stage info (for discount ID)
      SELECT cs.* INTO v_stage
      FROM club_stages cs
      WHERE cs.id = v_job.stage_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stage not found for sync job %', v_job.id;
      END IF;

      -- Build request body for our API endpoint
      v_request_body := jsonb_build_object(
        'queueId', v_job.id::TEXT,
        'clientId', v_client.id::TEXT,
        'actionType', v_job.action_type,
        'crmType', v_client.crm_type,
        'tenantShop', v_client.tenant_shop,
        'stageId', v_stage.id::TEXT,
        'discountId', v_stage.crm_discount_id,
        'customerCrmId', v_job.customer_crm_id
      );

      -- Add old_stage_id if this is an upgrade
      IF v_job.action_type = 'upgrade_membership' AND v_job.old_stage_id IS NOT NULL THEN
        SELECT cs.* INTO v_old_stage
        FROM club_stages cs
        WHERE cs.id = v_job.old_stage_id;

        IF FOUND THEN
          v_request_body := v_request_body || jsonb_build_object(
            'oldStageId', v_old_stage.id::TEXT,
            'oldDiscountId', v_old_stage.crm_discount_id
          );
        END IF;
      END IF;

      -- Call our API endpoint via pg_net
      -- This will call POST /api/cron/sync which processes the sync
      SELECT id INTO v_request_id
      FROM net.http_post(
        url := v_api_base_url || '/api/cron/sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'User-Agent', 'pg_net-cron-processor'
        ),
        body := v_request_body
      );

      -- Wait for response (pg_net is async, but we can check immediately in most cases)
      -- In production, we might want to check periodically
      PERFORM pg_sleep(1); -- Give it a moment

      -- Try to get the response
      SELECT 
        id,
        status_code,
        content::jsonb
      INTO 
        v_response_id,
        v_response_status,
        v_response_body
      FROM net.http_collect_response(request_id := v_request_id, async := false);

      -- Check if we got a response
      IF v_response_id IS NULL THEN
        -- Request might still be processing, mark for retry
        RAISE EXCEPTION 'Response not yet available for request %', v_request_id;
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
        updated_at = NOW()
      WHERE id = v_job.id;

      v_success := v_success + 1;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        v_error_msg := SQLERRM;

        -- Calculate exponential backoff (2^attempts minutes)
        v_next_retry := NOW() + (POWER(2, v_job.attempts) || ' minutes')::INTERVAL;

        -- Update queue with error
        UPDATE crm_sync_queue
        SET 
          status = CASE 
            WHEN v_job.attempts >= v_job.max_attempts - 1 THEN 'failed'
            ELSE 'pending'
          END,
          error_message = v_error_msg,
          next_retry_at = CASE 
            WHEN v_job.attempts >= v_job.max_attempts - 1 THEN NULL
            ELSE v_next_retry
          END,
          updated_at = NOW()
        WHERE id = v_job.id;

        -- Log warning
        RAISE WARNING 'Error processing sync job %: %', v_job.id, v_error_msg;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_success, v_errors;
END;
$$;

COMMENT ON FUNCTION process_crm_sync_queue() IS 'Processes pending CRM sync queue items by calling our API endpoint via pg_net. Handles tier membership operations: add_membership (from webhooks), cancel_membership (from cron expirations), upgrade_membership (from webhooks).';

