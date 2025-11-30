-- ============================================
-- Process Monthly Status Queue Function
-- ============================================
-- This function processes pending monthly status queue items
-- Similar to process_crm_sync_queue, but for monthly status notifications
-- Processes up to 50 jobs per run via pg_net HTTP calls to our API

CREATE OR REPLACE FUNCTION process_monthly_status_queue()
RETURNS TABLE(processed_count INTEGER, success_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
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
  v_api_base_url := COALESCE(
    current_setting('app.api_base_url', true),
    'http://localhost:5173'  -- Default for local dev
  );

  -- Process up to 50 pending jobs
  FOR v_job IN
    SELECT 
      msq.id,
      msq.client_id,
      msq.customer_id,
      msq.attempts,
      msq.max_attempts,
      msq.next_retry_at
    FROM monthly_status_queue msq
    WHERE msq.status = 'pending'
      AND (msq.next_retry_at IS NULL OR msq.next_retry_at <= NOW())
      AND msq.attempts < msq.max_attempts
    ORDER BY msq.created_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE monthly_status_queue
      SET 
        status = 'processing',
        attempts = attempts + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
      WHERE id = v_job.id;

      v_processed := v_processed + 1;

      -- Build request body for our API endpoint
      v_request_body := jsonb_build_object(
        'queueId', v_job.id::TEXT,
        'clientId', v_job.client_id::TEXT,
        'customerId', v_job.customer_id::TEXT
      );

      -- Call our API endpoint via pg_net
      -- This will call POST /api/cron/monthly-status/queue which processes a single customer
      SELECT id INTO v_request_id
      FROM net.http_post(
        url := v_api_base_url || '/api/cron/monthly-status/queue',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'User-Agent', 'pg_net-cron-processor'
        ),
        body := v_request_body::text
      );

      -- Wait for response (pg_net is async, but we can check immediately in most cases)
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
        RAISE EXCEPTION 'Monthly status failed: %', v_error_msg;
      END IF;

      -- Mark as completed
      UPDATE monthly_status_queue
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
        UPDATE monthly_status_queue
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
        RAISE WARNING 'Error processing monthly status queue job %: %', v_job.id, v_error_msg;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_success, v_errors;
END;
$$;

COMMENT ON FUNCTION process_monthly_status_queue() IS 'Processes pending monthly status queue items by calling our API endpoint via pg_net. Processes up to 50 jobs per run. Handles retries with exponential backoff.';

