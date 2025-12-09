-- ============================================
-- Monthly Status Notifications Function
-- ============================================
-- This function processes monthly status notifications for all clients
-- It calls the API endpoint for each client that has monthly status enabled
-- The API endpoint then processes all active members for that client

CREATE OR REPLACE FUNCTION process_monthly_status_notifications()
RETURNS TABLE(
  processed_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  client_record RECORD;
  api_base_url TEXT;
  processed_total INTEGER := 0;
  error_total INTEGER := 0;
  response_data JSONB;
  request_body JSONB;
BEGIN
  -- Get API base URL from app settings
  api_base_url := current_setting('app.api_base_url', true);
  
  IF api_base_url IS NULL OR api_base_url = '' THEN
    RAISE EXCEPTION 'app.api_base_url is not set';
  END IF;

  -- Loop through all clients with monthly status enabled
  FOR client_record IN
    SELECT c.id, c.org_name
    FROM clients c
    INNER JOIN communication_configs cc ON cc.client_id = c.id
    WHERE c.is_active = true
      AND cc.send_monthly_status = true
  LOOP
    BEGIN
      -- Prepare request body
      request_body := jsonb_build_object(
        'clientId', client_record.id
      );

      -- Call the API endpoint via pg_net
      SELECT content::jsonb INTO response_data
      FROM net.http_post(
        api_base_url || '/api/cron/monthly-status',  -- url
        request_body,                                 -- body (jsonb)
        '{}',                                         -- params
        jsonb_build_object(                           -- headers
          'Content-Type', 'application/json',
          'User-Agent', 'pg_net-cron-processor'
        )
      );

      -- Check if request was successful
      IF response_data->>'success' = 'true' THEN
        processed_total := processed_total + COALESCE((response_data->>'processed')::INTEGER, 0);
        error_total := error_total + COALESCE((response_data->>'errors')::INTEGER, 0);
        
        RAISE NOTICE 'Processed monthly status for client % (%), processed: %, errors: %',
          client_record.id,
          client_record.org_name,
          COALESCE((response_data->>'processed')::INTEGER, 0),
          COALESCE((response_data->>'errors')::INTEGER, 0);
      ELSE
        error_total := error_total + 1;
        RAISE WARNING 'Failed to process monthly status for client % (%): %',
          client_record.id,
          client_record.org_name,
          COALESCE(response_data->>'error', 'Unknown error');
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        error_total := error_total + 1;
        RAISE WARNING 'Exception processing monthly status for client % (%): %',
          client_record.id,
          client_record.org_name,
          SQLERRM;
    END;
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT processed_total, error_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_monthly_status_notifications() IS 'Processes monthly status notifications for all clients with monthly status enabled. Calls API endpoint for each client.';

