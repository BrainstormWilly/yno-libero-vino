-- Debug version to find where process_crm_sync_queue hangs
-- This adds RAISE NOTICE at every step

CREATE OR REPLACE FUNCTION process_crm_sync_queue()
RETURNS TABLE(processed_count INTEGER, success_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_processed INTEGER := 0;
  v_success INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Starting process_crm_sync_queue ===';
  
  -- Just try to select from the queue
  RAISE NOTICE 'Step 1: Selecting pending jobs...';
  
  FOR v_job IN
    SELECT 
      sq.id,
      sq.client_id,
      sq.action_type,
      sq.stage_id
    FROM crm_sync_queue sq
    WHERE sq.status = 'pending'
      AND (sq.next_retry_at IS NULL OR sq.next_retry_at <= NOW())
      AND sq.attempts < sq.max_attempts
    ORDER BY sq.created_at ASC
    LIMIT 1  -- Just process one for debugging
  LOOP
    RAISE NOTICE 'Step 2: Found job %', v_job.id;
    
    -- Try to update it
    RAISE NOTICE 'Step 3: Marking job as processing...';
    
    UPDATE crm_sync_queue
    SET 
      status = 'processing',
      attempts = attempts + 1,
      last_attempt_at = NOW(),
      updated_at = NOW()
    WHERE id = v_job.id;
    
    RAISE NOTICE 'Step 4: Job marked as processing';
    
    -- Immediately fail it for now
    RAISE NOTICE 'Step 5: Marking as failed for debugging...';
    
    UPDATE crm_sync_queue
    SET 
      status = 'failed',
      error_message = 'Debug: intentional failure',
      updated_at = NOW()
    WHERE id = v_job.id;
    
    RAISE NOTICE 'Step 6: Job marked as failed';
    
    v_processed := 1;
    v_errors := 1;
  END LOOP;
  
  RAISE NOTICE '=== Finished. Processed: %, Errors: % ===', v_processed, v_errors;
  
  RETURN QUERY SELECT v_processed, v_success, v_errors;
END;
$$;

