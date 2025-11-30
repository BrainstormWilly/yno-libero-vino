-- ============================================
-- Process Expiration Warning Queue Function
-- ============================================
-- This function processes pending expiration warning queue items
-- Similar to process_monthly_status_queue, but for expiration warnings
-- Processes up to 50 jobs per run via pg_net HTTP calls to our API

CREATE OR REPLACE FUNCTION process_expiration_warning_queue()
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
      ewq.id,
      ewq.client_id,
      ewq.customer_id,
      ewq.enrollment_id,
      ewq.attempts,
      ewq.max_attempts,
      ewq.next_retry_at
    FROM expiration_warning_queue ewq
    WHERE ewq.status = 'pending'
      AND (ewq.next_retry_at IS NULL OR ewq.next_retry_at <= NOW())
      AND ewq.attempts < ewq.max_attempts
    ORDER BY ewq.created_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE expiration_warning_queue
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
        'customerId', v_job.customer_id::TEXT,
        'enrollmentId', v_job.enrollment_id::TEXT
      );

      -- Call our API endpoint via pg_net
      SELECT id INTO v_request_id
      FROM net.http_post(
        url := v_api_base_url || '/api/cron/expiration-warning/queue',
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
        RAISE EXCEPTION 'Expiration warning failed: %', v_error_msg;
      END IF;

      -- Mark as completed
      UPDATE expiration_warning_queue
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
        UPDATE expiration_warning_queue
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
        RAISE WARNING 'Error processing expiration warning queue job %: %', v_job.id, v_error_msg;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_success, v_errors;
END;
$$;

COMMENT ON FUNCTION process_expiration_warning_queue() IS 'Processes pending expiration warning queue items by calling our API endpoint via pg_net. Processes up to 50 jobs per run. Handles retries with exponential backoff.';

