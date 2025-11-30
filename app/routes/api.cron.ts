/**
 * Cron Jobs API Resource Route
 * 
 * Provides endpoints to manually trigger cron jobs and check their status
 * - GET: Check cron job status and execution history
 * - POST: Manually trigger a cron job
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import { getSupabaseClient } from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const jobName = url.searchParams.get('job') || 'process-expired-enrollments';
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);

  try {
    const supabase = getSupabaseClient();

    // Get cron job status
    const { data: job, error: jobError } = await supabase
      .from('cron.job')
      .select('*')
      .eq('jobname', jobName)
      .single();

    if (jobError || !job) {
      return {
        error: `Cron job '${jobName}' not found`,
        job: null,
        history: [],
      };
    }

    // Get execution history if job exists
    const { data: history, error: historyError } = await supabase
      .from('cron.job_run_details')
      .select('*')
      .eq('jobid', job.jobid)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (historyError) {
      console.error('Error fetching cron job history:', historyError);
      return {
        job,
        history: [],
        error: 'Failed to fetch execution history',
      };
    }

    return {
      job: {
        jobid: job.jobid,
        schedule: job.schedule,
        command: job.command,
        nodename: job.nodename,
        nodeport: job.nodeport,
        database: job.database,
        username: job.username,
        active: job.active,
        jobname: job.jobname,
      },
      history: history || [],
    };
  } catch (error) {
    console.error('Error fetching cron job status:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch cron job status',
      job: null,
      history: [],
    };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  const jobName = (formData.get('job') as string) || 'process-expired-enrollments';

  try {
    const supabase = getSupabaseClient();

    if (actionType === 'trigger') {
      // Manually trigger the expiration processing function
      const { data, error } = await supabase.rpc('process_expired_enrollments');

      if (error) {
        console.error('Error triggering cron job:', error);
        return {
          success: false,
          error: error.message || 'Failed to trigger cron job',
          result: null,
        };
      }

      return {
        success: true,
        result: data,
        message: `Successfully processed ${data?.[0]?.processed_count || 0} enrollments with ${data?.[0]?.error_count || 0} errors`,
      };
    }

    if (actionType === 'test') {
      // Trigger the test function (same as trigger but uses test function)
      const { data, error } = await supabase.rpc('test_process_expired_enrollments');

      if (error) {
        console.error('Error running test function:', error);
        return {
          success: false,
          error: error.message || 'Failed to run test function',
          result: null,
        };
      }

      return {
        success: true,
        result: data,
        message: `Test run completed: ${data?.[0]?.processed_count || 0} processed, ${data?.[0]?.error_count || 0} errors`,
      };
    }

    if (actionType === 'sync') {
      // Manually trigger the CRM sync queue processor
      const { data, error } = await supabase.rpc('process_crm_sync_queue');

      if (error) {
        console.error('Error triggering sync queue processor:', error);
        return {
          success: false,
          error: error.message || 'Failed to trigger sync queue processor',
          result: null,
        };
      }

      return {
        success: true,
        result: data,
        message: `Processed ${data?.[0]?.processed_count || 0} sync jobs: ${data?.[0]?.success_count || 0} succeeded, ${data?.[0]?.error_count || 0} failed`,
      };
    }

    return {
      success: false,
      error: 'Invalid action. Use "trigger", "test", or "sync"',
    };
  } catch (error) {
    console.error('Error in cron job action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform action',
    };
  }
}

